import Dexie, { type Table } from "dexie";
import type {
  Clause,
  Category,
  Resume,
  JobListing,
  Recruiter,
  ResumeVersion,
} from "../types";
import type { AuditReport } from "../types/audit";

class JobTrackerDB extends Dexie {
  clauses!: Table<Clause, string>;
  categories!: Table<Category, string>;
  resumes!: Table<Resume, string>;
  jobs!: Table<JobListing, string>;
  recruiters!: Table<Recruiter, string>;
  resumeVersions!: Table<ResumeVersion, string>;
  auditReports!: Table<AuditReport, string>;
  settings!: Table<{ key: string; value: string }, string>;

  constructor() {
    super("JobTrackerDB");
    this.version(1).stores({
      clauses: "id, createdAt, updatedAt",
      categories: "id, name, createdAt",
      resumes: "id, name, createdAt, updatedAt",
      jobs: "id, title, company, status, addedAt, updatedAt",
      recruiters: "id, name, email, company, createdAt, updatedAt",
    });
    this.version(2).stores({
      clauses: "id, createdAt, updatedAt",
      categories: "id, name, createdAt",
      resumes: "id, name, createdAt, updatedAt",
      jobs: "id, title, company, status, addedAt, updatedAt",
      recruiters: "id, name, email, company, createdAt, updatedAt",
      resumeVersions: "id, resumeId, versionNumber, exportedAt",
    });
    this.version(3).stores({
      clauses: "id, createdAt, updatedAt",
      categories: "id, name, createdAt",
      resumes: "id, name, createdAt, updatedAt",
      jobs: "id, title, company, status, addedAt, updatedAt",
      recruiters: "id, name, email, company, createdAt, updatedAt",
      resumeVersions: "id, resumeId, versionNumber, exportedAt",
      auditReports: "id, resumeId, timestamp",
    });
    this.version(4).stores({
      clauses: "id, createdAt, updatedAt",
      categories: "id, name, createdAt",
      resumes: "id, name, createdAt, updatedAt",
      jobs: "id, title, company, status, addedAt, updatedAt",
      recruiters: "id, name, email, company, createdAt, updatedAt",
      resumeVersions: "id, resumeId, versionNumber, exportedAt",
      auditReports: "id, resumeId, timestamp",
      settings: "key",
    });
  }
}

export const db = new JobTrackerDB();

// Error types
export class StorageError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "StorageError";
    this.cause = cause;
  }
}

export class StorageUnavailableError extends StorageError {
  constructor(cause?: unknown) {
    super("IndexedDB is unavailable", cause);
    this.name = "StorageUnavailableError";
  }
}

export class CorruptedDataError extends StorageError {
  constructor(entity: string, cause?: unknown) {
    super(`Corrupted data in ${entity}`, cause);
    this.name = "CorruptedDataError";
  }
}

// Check if IndexedDB is available
export async function isStorageAvailable(): Promise<boolean> {
  try {
    await db.open();
    return true;
  } catch {
    return false;
  }
}

// Clause operations
export async function loadClauses(): Promise<Clause[]> {
  try {
    const clauses = await db.clauses.toArray();
    // Migrate old clauses that don't have the bullets field
    return clauses.map((clause) => ({
      ...clause,
      bullets: clause.bullets || [],
    }));
  } catch (error) {
    throw new CorruptedDataError("clauses", error);
  }
}

export async function saveClauses(clauses: Clause[]): Promise<void> {
  try {
    await db.transaction("rw", db.clauses, async () => {
      await db.clauses.clear();
      await db.clauses.bulkAdd(clauses);
    });
  } catch (error) {
    throw new StorageError("Failed to save clauses", error);
  }
}

export async function saveClause(clause: Clause): Promise<void> {
  try {
    await db.clauses.put(clause);
  } catch (error) {
    throw new StorageError("Failed to save clause", error);
  }
}

export async function deleteClause(id: string): Promise<void> {
  try {
    await db.clauses.delete(id);
  } catch (error) {
    throw new StorageError("Failed to delete clause", error);
  }
}

// Category operations
export async function loadCategories(): Promise<Category[]> {
  try {
    return await db.categories.toArray();
  } catch (error) {
    throw new CorruptedDataError("categories", error);
  }
}

export async function saveCategories(categories: Category[]): Promise<void> {
  try {
    await db.transaction("rw", db.categories, async () => {
      await db.categories.clear();
      await db.categories.bulkAdd(categories);
    });
  } catch (error) {
    throw new StorageError("Failed to save categories", error);
  }
}

export async function saveCategory(category: Category): Promise<void> {
  try {
    await db.categories.put(category);
  } catch (error) {
    throw new StorageError("Failed to save category", error);
  }
}

export async function deleteCategory(id: string): Promise<void> {
  try {
    await db.categories.delete(id);
  } catch (error) {
    throw new StorageError("Failed to delete category", error);
  }
}

// Resume operations
export async function loadResumes(): Promise<Resume[]> {
  try {
    const resumes = await db.resumes.toArray();
    // Migrate old resumes that don't have the new fields
    return resumes.map((resume) => ({
      ...resume,
      header: resume.header || { fullName: "", email: "" },
      skills: resume.skills || {},
      selectedClauseIds: resume.selectedClauseIds || [],
      education: resume.education || [],
    }));
  } catch (error) {
    throw new CorruptedDataError("resumes", error);
  }
}

export async function saveResumes(resumes: Resume[]): Promise<void> {
  try {
    await db.transaction("rw", db.resumes, async () => {
      await db.resumes.clear();
      await db.resumes.bulkAdd(resumes);
    });
  } catch (error) {
    throw new StorageError("Failed to save resumes", error);
  }
}

export async function saveResume(resume: Resume): Promise<void> {
  try {
    await db.resumes.put(resume);
  } catch (error) {
    throw new StorageError("Failed to save resume", error);
  }
}

export async function deleteResume(id: string): Promise<void> {
  try {
    await db.resumes.delete(id);
  } catch (error) {
    throw new StorageError("Failed to delete resume", error);
  }
}

// Job operations
export async function loadJobs(): Promise<JobListing[]> {
  try {
    return await db.jobs.toArray();
  } catch (error) {
    throw new CorruptedDataError("jobs", error);
  }
}

export async function saveJobs(jobs: JobListing[]): Promise<void> {
  try {
    await db.transaction("rw", db.jobs, async () => {
      await db.jobs.clear();
      await db.jobs.bulkAdd(jobs);
    });
  } catch (error) {
    throw new StorageError("Failed to save jobs", error);
  }
}

export async function saveJob(job: JobListing): Promise<void> {
  try {
    await db.jobs.put(job);
  } catch (error) {
    throw new StorageError("Failed to save job", error);
  }
}

export async function deleteJob(id: string): Promise<void> {
  try {
    await db.jobs.delete(id);
  } catch (error) {
    throw new StorageError("Failed to delete job", error);
  }
}

// Recruiter operations
export async function loadRecruiters(): Promise<Recruiter[]> {
  try {
    return await db.recruiters.toArray();
  } catch (error) {
    throw new CorruptedDataError("recruiters", error);
  }
}

export async function saveRecruiters(recruiters: Recruiter[]): Promise<void> {
  try {
    await db.transaction("rw", db.recruiters, async () => {
      await db.recruiters.clear();
      await db.recruiters.bulkAdd(recruiters);
    });
  } catch (error) {
    throw new StorageError("Failed to save recruiters", error);
  }
}

export async function saveRecruiter(recruiter: Recruiter): Promise<void> {
  try {
    await db.recruiters.put(recruiter);
  } catch (error) {
    throw new StorageError("Failed to save recruiter", error);
  }
}

export async function deleteRecruiter(id: string): Promise<void> {
  try {
    await db.recruiters.delete(id);
  } catch (error) {
    throw new StorageError("Failed to delete recruiter", error);
  }
}

// Reset all data
export async function resetAllData(): Promise<void> {
  try {
    await db.transaction(
      "rw",
      [
        db.clauses,
        db.categories,
        db.resumes,
        db.jobs,
        db.recruiters,
        db.resumeVersions,
        db.auditReports,
      ],
      async () => {
        await db.clauses.clear();
        await db.categories.clear();
        await db.resumes.clear();
        await db.jobs.clear();
        await db.recruiters.clear();
        await db.resumeVersions.clear();
        await db.auditReports.clear();
      },
    );
  } catch (error) {
    throw new StorageError("Failed to reset data", error);
  }
}

// Resume Version operations
export async function loadResumeVersions(
  resumeId: string,
): Promise<ResumeVersion[]> {
  try {
    return await db.resumeVersions
      .where("resumeId")
      .equals(resumeId)
      .sortBy("versionNumber");
  } catch (error) {
    throw new CorruptedDataError("resumeVersions", error);
  }
}

export async function saveResumeVersion(version: ResumeVersion): Promise<void> {
  try {
    await db.resumeVersions.put(version);
  } catch (error) {
    throw new StorageError("Failed to save resume version", error);
  }
}

export async function deleteResumeVersion(id: string): Promise<void> {
  try {
    await db.resumeVersions.delete(id);
  } catch (error) {
    throw new StorageError("Failed to delete resume version", error);
  }
}

export async function deleteResumeVersionsByResumeId(
  resumeId: string,
): Promise<void> {
  try {
    await db.resumeVersions.where("resumeId").equals(resumeId).delete();
  } catch (error) {
    throw new StorageError("Failed to delete resume versions", error);
  }
}

export async function getNextVersionNumber(resumeId: string): Promise<number> {
  try {
    const versions = await db.resumeVersions
      .where("resumeId")
      .equals(resumeId)
      .toArray();
    if (versions.length === 0) return 1;
    return Math.max(...versions.map((v) => v.versionNumber)) + 1;
  } catch (error) {
    throw new StorageError("Failed to get next version number", error);
  }
}

// Audit Report operations
export async function loadAuditReport(
  resumeId: string,
): Promise<AuditReport | null> {
  try {
    // Get the most recent audit report for the resume
    const reports = await db.auditReports
      .where("resumeId")
      .equals(resumeId)
      .sortBy("timestamp");
    return reports.length > 0 ? reports[reports.length - 1] : null;
  } catch (error) {
    throw new CorruptedDataError("auditReports", error);
  }
}

export async function saveAuditReport(report: AuditReport): Promise<void> {
  try {
    await db.auditReports.put(report);
  } catch (error) {
    throw new StorageError("Failed to save audit report", error);
  }
}

export async function deleteAuditReport(id: string): Promise<void> {
  try {
    await db.auditReports.delete(id);
  } catch (error) {
    throw new StorageError("Failed to delete audit report", error);
  }
}

export async function deleteAuditReportsByResumeId(
  resumeId: string,
): Promise<void> {
  try {
    await db.auditReports.where("resumeId").equals(resumeId).delete();
  } catch (error) {
    throw new StorageError("Failed to delete audit reports", error);
  }
}

// ─── Settings (resume defaults) ─────────────────────────────

export async function loadSetting(key: string): Promise<string | null> {
  try {
    const row = await db.settings.get(key);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function saveSetting(key: string, value: string): Promise<void> {
  try {
    await db.settings.put({ key, value });
  } catch (error) {
    throw new StorageError("Failed to save setting", error);
  }
}
