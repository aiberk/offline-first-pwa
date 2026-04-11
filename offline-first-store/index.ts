import { create } from "zustand";
import { nanoid } from "nanoid";
import type {
  Clause,
  Category,
  Resume,
  ResumeSection,
  SectionContent,
  JobListing,
  JobStatus,
  Recruiter,
  ResumeVersion,
  ResumeHeader,
  SkillsSection,
  EducationEntry,
  AchievementEntry,
  LeadershipEntry,
  SummaryEntry,
} from "../types";
import type { AuditReport } from "../types/audit";
import type { JobMatchReport } from "../types/jobMatch";
import * as storage from "../services/storage";
import {
  isDemoMode,
  DEMO_CLAUSES,
  DEMO_CATEGORIES,
  DEMO_RESUMES,
  DEMO_JOBS,
} from "../constants/demoData";
import {
  DEFAULT_HEADER,
  DEFAULT_EDUCATION,
  DEFAULT_SKILLS,
  DEFAULT_ACHIEVEMENTS,
  DEFAULT_LEADERSHIP,
} from "../constants/resumeDefaults";
import { atsAuditor } from "../services/audit/atsAuditor";
import { analyzeJobMatch } from "../services/jobMatch/jobMatchAnalyzer";

// Helper to load user's saved defaults from IndexedDB
async function loadUserDefaults(): Promise<{
  header: ResumeHeader;
  education: EducationEntry[];
  skills: SkillsSection;
  achievements: AchievementEntry[];
  leadership: LeadershipEntry[];
}> {
  try {
    const stored = await storage.loadSetting("resume-defaults");
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        header: parsed.header || DEFAULT_HEADER,
        education: parsed.education || DEFAULT_EDUCATION,
        skills: parsed.skills || DEFAULT_SKILLS,
        achievements: parsed.achievements || DEFAULT_ACHIEVEMENTS,
        leadership: parsed.leadership || DEFAULT_LEADERSHIP,
      };
    }
  } catch (e) {
    console.error("Failed to load user defaults:", e);
  }
  return {
    header: DEFAULT_HEADER,
    education: DEFAULT_EDUCATION,
    skills: DEFAULT_SKILLS,
    achievements: DEFAULT_ACHIEVEMENTS,
    leadership: DEFAULT_LEADERSHIP,
  };
}

// Store state interface
interface AppState {
  // Clause state
  clauses: Clause[];
  // Category state
  categories: Category[];
  // Resume state
  resumes: Resume[];
  // Resume versions state
  resumeVersions: Record<string, ResumeVersion[]>;
  // Job state
  jobs: JobListing[];
  // Recruiter state
  recruiters: Recruiter[];
  // Loading state
  isLoading: boolean;
  // Error state
  error: string | null;
  // Audit state
  auditReports: Record<string, AuditReport>; // resumeId -> latest report
  isAuditing: boolean;
  auditError: string | null;
  // Job Match state
  jobMatchReports: Record<string, JobMatchReport>; // resumeId -> latest report
  isMatchingJob: boolean;
  jobMatchError: string | null;
  // Summary library
  summaries: SummaryEntry[];
}

// Store actions interface
interface AppActions {
  // Initialization
  initialize: () => Promise<void>;
  clearError: () => void;

  // Clause actions
  addClause: (text: string, categoryIds: string[]) => Promise<Clause>;
  addJobClause: (
    clause: Omit<Clause, "id" | "createdAt" | "updatedAt">,
  ) => Promise<Clause>;
  updateClause: (
    id: string,
    text: string,
    categoryIds: string[],
  ) => Promise<void>;
  updateJobClause: (
    id: string,
    updates: Partial<Omit<Clause, "id" | "createdAt" | "updatedAt">>,
  ) => Promise<void>;
  deleteClause: (id: string) => Promise<void>;

  // Category actions
  addCategory: (name: string) => Promise<Category>;
  deleteCategory: (id: string) => Promise<void>;

  // Resume actions
  createResume: (name?: string) => Promise<Resume>;
  updateResume: (id: string, name: string) => Promise<void>;
  updateResumeTags: (id: string, tags: string[]) => Promise<void>;
  updateResumeHeader: (id: string, header: ResumeHeader) => Promise<void>;
  updateResumeSkills: (id: string, skills: SkillsSection) => Promise<void>;
  updateResumeEducation: (
    id: string,
    education: EducationEntry[],
  ) => Promise<void>;
  updateResumeAchievements: (
    id: string,
    achievements: AchievementEntry[],
  ) => Promise<void>;
  updateResumeLeadership: (
    id: string,
    leadership: LeadershipEntry[],
  ) => Promise<void>;
  updateResumeSectionVisibility: (
    id: string,
    section: string,
    visible: boolean,
  ) => Promise<void>;
  toggleResumeClause: (resumeId: string, clauseId: string) => Promise<void>;
  toggleKeyEngagement: (resumeId: string, clauseId: string) => Promise<void>;
  updateKeyEngagementBullet: (
    resumeId: string,
    clauseId: string,
    bulletIndex: number,
  ) => Promise<void>;
  toggleBulletVisibility: (
    resumeId: string,
    clauseId: string,
    bulletIndex: number,
  ) => Promise<void>;
  reorderResumeClauses: (
    resumeId: string,
    clauseIds: string[],
  ) => Promise<void>;
  deleteResume: (id: string) => Promise<void>;
  duplicateResume: (id: string) => Promise<Resume>;

  // Section actions
  addSection: (resumeId: string, title: string) => Promise<void>;
  updateSection: (
    resumeId: string,
    sectionId: string,
    title: string,
  ) => Promise<void>;
  deleteSection: (resumeId: string, sectionId: string) => Promise<void>;
  reorderSections: (resumeId: string, sectionIds: string[]) => Promise<void>;

  // Content actions
  addContent: (
    resumeId: string,
    sectionId: string,
    content: SectionContent,
  ) => Promise<void>;
  removeContent: (
    resumeId: string,
    sectionId: string,
    contentId: string,
  ) => Promise<void>;
  reorderContent: (
    resumeId: string,
    sectionId: string,
    contentIds: string[],
  ) => Promise<void>;

  // Job actions
  addJob: (
    job: Omit<JobListing, "id" | "status" | "notes" | "addedAt" | "updatedAt">,
  ) => Promise<JobListing>;
  updateJob: (
    id: string,
    updates: Partial<Omit<JobListing, "id" | "addedAt">>,
  ) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
  updateJobStatus: (id: string, status: JobStatus) => Promise<void>;
  updateJobNotes: (id: string, notes: string) => Promise<void>;

  // Recruiter actions
  addRecruiter: (
    recruiter: Omit<
      Recruiter,
      "id" | "linkedJobIds" | "createdAt" | "updatedAt"
    >,
  ) => Promise<Recruiter>;
  updateRecruiter: (
    id: string,
    updates: Partial<Omit<Recruiter, "id" | "linkedJobIds" | "createdAt">>,
  ) => Promise<void>;
  deleteRecruiter: (id: string) => Promise<void>;
  linkJob: (recruiterId: string, jobId: string) => Promise<void>;
  unlinkJob: (recruiterId: string, jobId: string) => Promise<void>;

  // Resume version actions
  loadResumeVersions: (resumeId: string) => Promise<void>;
  exportResume: (resumeId: string, note?: string) => Promise<ResumeVersion>;
  deleteResumeVersion: (versionId: string, resumeId: string) => Promise<void>;

  // Audit actions
  runAudit: (resumeId: string) => Promise<AuditReport>;
  clearAuditReport: (resumeId: string) => void;
  exportAuditReport: (resumeId: string) => Promise<void>;

  // Job Match actions
  runJobMatch: (
    resumeId: string,
    jobDescription: string,
    jobTitle: string,
    jobCompany: string,
    jobId?: string,
  ) => Promise<JobMatchReport>;
  clearJobMatchReport: (resumeId: string) => void;
  setJobMatchReport: (
    resumeId: string,
    report: JobMatchReport,
  ) => Promise<void>;

  // Summary library actions
  addSummary: (name: string, text: string) => SummaryEntry;
  updateSummary: (id: string, name: string, text: string) => void;
  deleteSummary: (id: string) => void;
}

export type Store = AppState & AppActions;

export const useStore = create<Store>((set, get) => ({
  // Initial state
  clauses: [],
  categories: [],
  resumes: [],
  resumeVersions: {},
  jobs: [],
  recruiters: [],
  isLoading: true,
  error: null,
  // Audit initial state
  auditReports: {},
  isAuditing: false,
  auditError: null,
  // Job Match initial state
  jobMatchReports: {},
  isMatchingJob: false,
  jobMatchError: null,
  // Summary library
  summaries: (() => {
    try {
      const stored = localStorage.getItem("summary-library");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  })(),

  // Initialize store from IndexedDB (or demo data)
  initialize: async () => {
    try {
      set({ isLoading: true, error: null });

      // Demo mode: seed fake data, skip IndexedDB
      if (isDemoMode()) {
        set({
          clauses: DEMO_CLAUSES,
          categories: DEMO_CATEGORIES,
          resumes: DEMO_RESUMES,
          jobs: DEMO_JOBS,
          recruiters: [],
          isLoading: false,
        });
        return;
      }

      // Sync import: hydrate from P2P transfer
      const syncRaw = localStorage.getItem("sync-import");
      if (syncRaw) {
        try {
          const syncData = JSON.parse(syncRaw);
          const clauses: Clause[] = syncData.clauses ?? [];
          const categories: Category[] = syncData.categories ?? [];
          const resumes: Resume[] = syncData.resumes ?? [];
          const jobs: JobListing[] = syncData.jobs ?? [];
          const recruiters: Recruiter[] = syncData.recruiters ?? [];

          // Write to IndexedDB so it persists
          await Promise.all([
            ...clauses.map((c: Clause) => storage.saveClause(c)),
            ...categories.map((c: Category) => storage.saveCategory(c)),
            ...resumes.map((r: Resume) => storage.saveResume(r)),
            ...jobs.map((j: JobListing) => storage.saveJob(j)),
            ...recruiters.map((r: Recruiter) => storage.saveRecruiter(r)),
          ]);

          localStorage.removeItem("sync-import");
          set({
            clauses,
            categories,
            resumes,
            jobs,
            recruiters,
            isLoading: false,
          });
          return;
        } catch (e) {
          console.error("Failed to import sync data:", e);
          localStorage.removeItem("sync-import");
        }
      }

      const [clauses, categories, resumes, jobs, recruiters] =
        await Promise.all([
          storage.loadClauses(),
          storage.loadCategories(),
          storage.loadResumes(),
          storage.loadJobs(),
          storage.loadRecruiters(),
        ]);
      set({ clauses, categories, resumes, jobs, recruiters, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Failed to load data",
        isLoading: false,
      });
    }
  },

  clearError: () => set({ error: null }),

  // Clause actions
  addClause: async (text: string, categoryIds: string[]) => {
    const now = Date.now();
    const clause: Clause = {
      id: nanoid(),
      text,
      bullets: [],
      categoryIds,
      createdAt: now,
      updatedAt: now,
    };
    await storage.saveClause(clause);
    set((state) => ({ clauses: [...state.clauses, clause] }));
    return clause;
  },

  addJobClause: async (
    clauseData: Omit<Clause, "id" | "createdAt" | "updatedAt">,
  ) => {
    const now = Date.now();
    const clause: Clause = {
      ...clauseData,
      id: nanoid(),
      createdAt: now,
      updatedAt: now,
    };
    await storage.saveClause(clause);
    set((state) => ({ clauses: [...state.clauses, clause] }));
    return clause;
  },

  updateClause: async (id: string, text: string, categoryIds: string[]) => {
    const state = get();
    const clause = state.clauses.find((c) => c.id === id);
    if (!clause) return;

    const updated: Clause = {
      ...clause,
      text,
      categoryIds,
      updatedAt: Date.now(),
    };
    await storage.saveClause(updated);
    set((state) => ({
      clauses: state.clauses.map((c) => (c.id === id ? updated : c)),
    }));
  },

  updateJobClause: async (
    id: string,
    updates: Partial<Omit<Clause, "id" | "createdAt" | "updatedAt">>,
  ) => {
    const state = get();
    const clause = state.clauses.find((c) => c.id === id);
    if (!clause) return;

    const updated: Clause = {
      ...clause,
      ...updates,
      updatedAt: Date.now(),
    };
    await storage.saveClause(updated);
    set((state) => ({
      clauses: state.clauses.map((c) => (c.id === id ? updated : c)),
    }));
  },

  deleteClause: async (id: string) => {
    await storage.deleteClause(id);
    set((state) => ({
      clauses: state.clauses.filter((c) => c.id !== id),
    }));
  },

  // Category actions
  addCategory: async (name: string) => {
    const category: Category = {
      id: nanoid(),
      name,
      createdAt: Date.now(),
    };
    await storage.saveCategory(category);
    set((state) => ({ categories: [...state.categories, category] }));
    return category;
  },

  deleteCategory: async (id: string) => {
    const state = get();
    // Cascade: remove category from all clauses
    const updatedClauses = state.clauses.map((clause) => {
      if (clause.categoryIds.includes(id)) {
        return {
          ...clause,
          categoryIds: clause.categoryIds.filter((cid) => cid !== id),
          updatedAt: Date.now(),
        };
      }
      return clause;
    });

    // Save updated clauses
    const clausesToUpdate = updatedClauses.filter(
      (c, i) => c.updatedAt !== state.clauses[i].updatedAt,
    );
    await Promise.all(clausesToUpdate.map((c) => storage.saveClause(c)));

    // Delete category
    await storage.deleteCategory(id);

    set({
      categories: state.categories.filter((c) => c.id !== id),
      clauses: updatedClauses,
    });
  },

  // Resume actions
  createResume: async (
    name = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }),
  ) => {
    const now = Date.now();
    // Load user's saved defaults (or fall back to hardcoded defaults)
    const userDefaults = await loadUserDefaults();
    // Give education entries unique IDs
    const educationWithIds = userDefaults.education.map((edu) => ({
      ...edu,
      id: nanoid(),
    }));
    // Give achievement entries unique IDs
    const achievementsWithIds = (userDefaults.achievements || []).map(
      (ach) => ({
        ...ach,
        id: nanoid(),
      }),
    );
    // Give leadership entries unique IDs
    const leadershipWithIds = (userDefaults.leadership || []).map((lead) => ({
      ...lead,
      id: nanoid(),
    }));
    const resume: Resume = {
      id: nanoid(),
      name,
      header: { ...userDefaults.header },
      skills: { ...userDefaults.skills },
      selectedClauseIds: [],
      education: educationWithIds,
      achievements: achievementsWithIds,
      leadership: leadershipWithIds,
      sections: [],
      createdAt: now,
      updatedAt: now,
    };
    await storage.saveResume(resume);
    set((state) => ({ resumes: [...state.resumes, resume] }));
    return resume;
  },

  updateResume: async (id: string, name: string) => {
    const state = get();
    const resume = state.resumes.find((r) => r.id === id);
    if (!resume) return;

    const updated: Resume = { ...resume, name, updatedAt: Date.now() };
    await storage.saveResume(updated);
    set((state) => ({
      resumes: state.resumes.map((r) => (r.id === id ? updated : r)),
    }));
  },

  updateResumeTags: async (id: string, tags: string[]) => {
    const state = get();
    const resume = state.resumes.find((r) => r.id === id);
    if (!resume) return;

    const updated: Resume = { ...resume, tags, updatedAt: Date.now() };
    await storage.saveResume(updated);
    set((state) => ({
      resumes: state.resumes.map((r) => (r.id === id ? updated : r)),
    }));
  },

  updateResumeHeader: async (id: string, header: ResumeHeader) => {
    const state = get();
    const resume = state.resumes.find((r) => r.id === id);
    if (!resume) return;

    const updated: Resume = { ...resume, header, updatedAt: Date.now() };
    await storage.saveResume(updated);
    set((state) => ({
      resumes: state.resumes.map((r) => (r.id === id ? updated : r)),
    }));
  },

  updateResumeSkills: async (id: string, skills: SkillsSection) => {
    const state = get();
    const resume = state.resumes.find((r) => r.id === id);
    if (!resume) return;

    const updated: Resume = { ...resume, skills, updatedAt: Date.now() };
    await storage.saveResume(updated);
    set((state) => ({
      resumes: state.resumes.map((r) => (r.id === id ? updated : r)),
    }));
  },

  updateResumeEducation: async (id: string, education: EducationEntry[]) => {
    const state = get();
    const resume = state.resumes.find((r) => r.id === id);
    if (!resume) return;

    const updated: Resume = { ...resume, education, updatedAt: Date.now() };
    await storage.saveResume(updated);
    set((state) => ({
      resumes: state.resumes.map((r) => (r.id === id ? updated : r)),
    }));
  },

  updateResumeAchievements: async (
    id: string,
    achievements: AchievementEntry[],
  ) => {
    const state = get();
    const resume = state.resumes.find((r) => r.id === id);
    if (!resume) return;

    const updated: Resume = { ...resume, achievements, updatedAt: Date.now() };
    await storage.saveResume(updated);
    set((state) => ({
      resumes: state.resumes.map((r) => (r.id === id ? updated : r)),
    }));
  },

  updateResumeLeadership: async (id: string, leadership: LeadershipEntry[]) => {
    const state = get();
    const resume = state.resumes.find((r) => r.id === id);
    if (!resume) return;

    const updated: Resume = { ...resume, leadership, updatedAt: Date.now() };
    await storage.saveResume(updated);
    set((state) => ({
      resumes: state.resumes.map((r) => (r.id === id ? updated : r)),
    }));
  },

  updateResumeSectionVisibility: async (
    id: string,
    section: string,
    visible: boolean,
  ) => {
    const state = get();
    const resume = state.resumes.find((r) => r.id === id);
    if (!resume) return;

    const sectionVisibility = {
      ...(resume.sectionVisibility || {}),
      [section]: visible,
    };
    const updated: Resume = {
      ...resume,
      sectionVisibility,
      updatedAt: Date.now(),
    };
    await storage.saveResume(updated);
    set((state) => ({
      resumes: state.resumes.map((r) => (r.id === id ? updated : r)),
    }));
  },

  toggleResumeClause: async (resumeId: string, clauseId: string) => {
    const state = get();
    const resume = state.resumes.find((r) => r.id === resumeId);
    if (!resume) return;

    const currentIds = resume.selectedClauseIds || [];
    const selectedClauseIds = currentIds.includes(clauseId)
      ? currentIds.filter((id) => id !== clauseId)
      : [...currentIds, clauseId];

    const updated: Resume = {
      ...resume,
      selectedClauseIds,
      updatedAt: Date.now(),
    };
    await storage.saveResume(updated);
    set((state) => ({
      resumes: state.resumes.map((r) => (r.id === resumeId ? updated : r)),
    }));
  },

  toggleKeyEngagement: async (resumeId: string, clauseId: string) => {
    const state = get();
    const resume = state.resumes.find((r) => r.id === resumeId);
    if (!resume) return;

    const currentEngagements = resume.keyEngagements || {};
    let keyEngagements: Record<string, number[]>;

    if (clauseId in currentEngagements) {
      // Remove it
      const { [clauseId]: _, ...rest } = currentEngagements;
      keyEngagements = rest;
    } else {
      // Add it with default bullet index [0]
      keyEngagements = { ...currentEngagements, [clauseId]: [0] };
    }

    const updated: Resume = {
      ...resume,
      keyEngagements,
      updatedAt: Date.now(),
    };
    await storage.saveResume(updated);
    set((state) => ({
      resumes: state.resumes.map((r) => (r.id === resumeId ? updated : r)),
    }));
  },

  updateKeyEngagementBullet: async (
    resumeId: string,
    clauseId: string,
    bulletIndex: number,
  ) => {
    const state = get();
    const resume = state.resumes.find((r) => r.id === resumeId);
    if (!resume) return;

    // Handle both old format (number) and new format (number[])
    const rawBullets = resume.keyEngagements?.[clauseId];
    const currentBullets = Array.isArray(rawBullets)
      ? rawBullets
      : rawBullets !== undefined
        ? [rawBullets]
        : [];
    let newBullets: number[];

    if (currentBullets.includes(bulletIndex)) {
      // Remove it (but keep at least one)
      newBullets = currentBullets.filter((i) => i !== bulletIndex);
      if (newBullets.length === 0) newBullets = [bulletIndex];
    } else {
      // Add it
      newBullets = [...currentBullets, bulletIndex].sort((a, b) => a - b);
    }

    const keyEngagements = {
      ...(resume.keyEngagements || {}),
      [clauseId]: newBullets,
    };

    const updated: Resume = {
      ...resume,
      keyEngagements,
      updatedAt: Date.now(),
    };
    await storage.saveResume(updated);
    set((state) => ({
      resumes: state.resumes.map((r) => (r.id === resumeId ? updated : r)),
    }));
  },

  toggleBulletVisibility: async (
    resumeId: string,
    clauseId: string,
    bulletIndex: number,
  ) => {
    const state = get();
    const resume = state.resumes.find((r) => r.id === resumeId);
    if (!resume) return;

    const currentHidden = resume.hiddenBullets?.[clauseId] || [];
    let newHidden: number[];

    if (currentHidden.includes(bulletIndex)) {
      newHidden = currentHidden.filter((i) => i !== bulletIndex);
    } else {
      newHidden = [...currentHidden, bulletIndex].sort((a, b) => a - b);
    }

    const hiddenBullets = {
      ...(resume.hiddenBullets || {}),
      [clauseId]: newHidden,
    };

    // Clean up empty arrays
    if (newHidden.length === 0) {
      delete hiddenBullets[clauseId];
    }

    const updated: Resume = {
      ...resume,
      hiddenBullets,
      updatedAt: Date.now(),
    };
    await storage.saveResume(updated);
    set((state) => ({
      resumes: state.resumes.map((r) => (r.id === resumeId ? updated : r)),
    }));
  },

  reorderResumeClauses: async (resumeId: string, clauseIds: string[]) => {
    const state = get();
    const resume = state.resumes.find((r) => r.id === resumeId);
    if (!resume) return;

    const updated: Resume = {
      ...resume,
      selectedClauseIds: clauseIds,
      updatedAt: Date.now(),
    };
    await storage.saveResume(updated);
    set((state) => ({
      resumes: state.resumes.map((r) => (r.id === resumeId ? updated : r)),
    }));
  },

  deleteResume: async (id: string) => {
    await storage.deleteResume(id);
    set((state) => ({
      resumes: state.resumes.filter((r) => r.id !== id),
    }));
  },

  duplicateResume: async (id: string) => {
    const state = get();
    const original = state.resumes.find((r) => r.id === id);
    if (!original) throw new Error("Resume not found");

    const now = Date.now();
    // Deep copy sections with new IDs
    const sections: ResumeSection[] = original.sections.map((section) => ({
      id: nanoid(),
      title: section.title,
      content: section.content.map((c) => ({ ...c, id: nanoid() })),
    }));

    // Deep copy education with new IDs
    const education: EducationEntry[] = (original.education || []).map((e) => ({
      ...e,
      id: nanoid(),
    }));

    // Deep copy achievements with new IDs
    const achievements: AchievementEntry[] = (original.achievements || []).map(
      (a) => ({
        ...a,
        id: nanoid(),
      }),
    );

    // Deep copy leadership with new IDs
    const leadership: LeadershipEntry[] = (original.leadership || []).map(
      (l) => ({
        ...l,
        id: nanoid(),
      }),
    );

    const duplicate: Resume = {
      id: nanoid(),
      name: `${original.name} (Copy)`,
      header: { ...original.header },
      skills: { ...original.skills },
      selectedClauseIds: [...(original.selectedClauseIds || [])],
      education,
      achievements,
      leadership,
      sections,
      createdAt: now,
      updatedAt: now,
    };
    await storage.saveResume(duplicate);
    set((state) => ({ resumes: [...state.resumes, duplicate] }));
    return duplicate;
  },

  // Section actions
  addSection: async (resumeId: string, title: string) => {
    const state = get();
    const resume = state.resumes.find((r) => r.id === resumeId);
    if (!resume) return;

    const section: ResumeSection = { id: nanoid(), title, content: [] };
    const updated: Resume = {
      ...resume,
      sections: [...resume.sections, section],
      updatedAt: Date.now(),
    };
    await storage.saveResume(updated);
    set((state) => ({
      resumes: state.resumes.map((r) => (r.id === resumeId ? updated : r)),
    }));
  },

  updateSection: async (resumeId: string, sectionId: string, title: string) => {
    const state = get();
    const resume = state.resumes.find((r) => r.id === resumeId);
    if (!resume) return;

    const updated: Resume = {
      ...resume,
      sections: resume.sections.map((s) =>
        s.id === sectionId ? { ...s, title } : s,
      ),
      updatedAt: Date.now(),
    };
    await storage.saveResume(updated);
    set((state) => ({
      resumes: state.resumes.map((r) => (r.id === resumeId ? updated : r)),
    }));
  },

  deleteSection: async (resumeId: string, sectionId: string) => {
    const state = get();
    const resume = state.resumes.find((r) => r.id === resumeId);
    if (!resume) return;

    const updated: Resume = {
      ...resume,
      sections: resume.sections.filter((s) => s.id !== sectionId),
      updatedAt: Date.now(),
    };
    await storage.saveResume(updated);
    set((state) => ({
      resumes: state.resumes.map((r) => (r.id === resumeId ? updated : r)),
    }));
  },

  reorderSections: async (resumeId: string, sectionIds: string[]) => {
    const state = get();
    const resume = state.resumes.find((r) => r.id === resumeId);
    if (!resume) return;

    const sectionMap = new Map(resume.sections.map((s) => [s.id, s]));
    const reordered = sectionIds
      .map((id) => sectionMap.get(id))
      .filter((s): s is ResumeSection => s !== undefined);

    const updated: Resume = {
      ...resume,
      sections: reordered,
      updatedAt: Date.now(),
    };
    await storage.saveResume(updated);
    set((state) => ({
      resumes: state.resumes.map((r) => (r.id === resumeId ? updated : r)),
    }));
  },

  // Content actions
  addContent: async (
    resumeId: string,
    sectionId: string,
    content: SectionContent,
  ) => {
    const state = get();
    const resume = state.resumes.find((r) => r.id === resumeId);
    if (!resume) return;

    const updated: Resume = {
      ...resume,
      sections: resume.sections.map((s) =>
        s.id === sectionId ? { ...s, content: [...s.content, content] } : s,
      ),
      updatedAt: Date.now(),
    };
    await storage.saveResume(updated);
    set((state) => ({
      resumes: state.resumes.map((r) => (r.id === resumeId ? updated : r)),
    }));
  },

  removeContent: async (
    resumeId: string,
    sectionId: string,
    contentId: string,
  ) => {
    const state = get();
    const resume = state.resumes.find((r) => r.id === resumeId);
    if (!resume) return;

    const updated: Resume = {
      ...resume,
      sections: resume.sections.map((s) =>
        s.id === sectionId
          ? { ...s, content: s.content.filter((c) => c.id !== contentId) }
          : s,
      ),
      updatedAt: Date.now(),
    };
    await storage.saveResume(updated);
    set((state) => ({
      resumes: state.resumes.map((r) => (r.id === resumeId ? updated : r)),
    }));
  },

  reorderContent: async (
    resumeId: string,
    sectionId: string,
    contentIds: string[],
  ) => {
    const state = get();
    const resume = state.resumes.find((r) => r.id === resumeId);
    if (!resume) return;

    const section = resume.sections.find((s) => s.id === sectionId);
    if (!section) return;

    const contentMap = new Map(section.content.map((c) => [c.id, c]));
    const reordered = contentIds
      .map((id) => contentMap.get(id))
      .filter((c): c is SectionContent => c !== undefined);

    const updated: Resume = {
      ...resume,
      sections: resume.sections.map((s) =>
        s.id === sectionId ? { ...s, content: reordered } : s,
      ),
      updatedAt: Date.now(),
    };
    await storage.saveResume(updated);
    set((state) => ({
      resumes: state.resumes.map((r) => (r.id === resumeId ? updated : r)),
    }));
  },

  // Job actions
  addJob: async (job) => {
    const now = Date.now();
    const newJob: JobListing = {
      ...job,
      id: nanoid(),
      status: "saved",
      notes: "",
      addedAt: now,
      updatedAt: now,
    };
    await storage.saveJob(newJob);
    set((state) => ({ jobs: [...state.jobs, newJob] }));
    return newJob;
  },

  updateJob: async (id: string, updates) => {
    const state = get();
    const job = state.jobs.find((j) => j.id === id);
    if (!job) return;

    const updated: JobListing = { ...job, ...updates, updatedAt: Date.now() };
    await storage.saveJob(updated);
    set((state) => ({
      jobs: state.jobs.map((j) => (j.id === id ? updated : j)),
    }));
  },

  deleteJob: async (id: string) => {
    const state = get();
    // Also unlink from any recruiters
    const recruitersToUpdate = state.recruiters.filter((r) =>
      r.linkedJobIds.includes(id),
    );

    for (const recruiter of recruitersToUpdate) {
      const updated: Recruiter = {
        ...recruiter,
        linkedJobIds: recruiter.linkedJobIds.filter((jid) => jid !== id),
        updatedAt: Date.now(),
      };
      await storage.saveRecruiter(updated);
    }

    await storage.deleteJob(id);
    set((state) => ({
      jobs: state.jobs.filter((j) => j.id !== id),
      recruiters: state.recruiters.map((r) =>
        r.linkedJobIds.includes(id)
          ? {
              ...r,
              linkedJobIds: r.linkedJobIds.filter((jid) => jid !== id),
              updatedAt: Date.now(),
            }
          : r,
      ),
    }));
  },

  updateJobStatus: async (id: string, status: JobStatus) => {
    const state = get();
    const job = state.jobs.find((j) => j.id === id);
    if (!job) return;

    const updated: JobListing = { ...job, status, updatedAt: Date.now() };
    await storage.saveJob(updated);
    set((state) => ({
      jobs: state.jobs.map((j) => (j.id === id ? updated : j)),
    }));
  },

  updateJobNotes: async (id: string, notes: string) => {
    const state = get();
    const job = state.jobs.find((j) => j.id === id);
    if (!job) return;

    const updated: JobListing = { ...job, notes, updatedAt: Date.now() };
    await storage.saveJob(updated);
    set((state) => ({
      jobs: state.jobs.map((j) => (j.id === id ? updated : j)),
    }));
  },

  // Recruiter actions
  addRecruiter: async (recruiter) => {
    const now = Date.now();
    const newRecruiter: Recruiter = {
      ...recruiter,
      id: nanoid(),
      linkedJobIds: [],
      createdAt: now,
      updatedAt: now,
    };
    await storage.saveRecruiter(newRecruiter);
    set((state) => ({ recruiters: [...state.recruiters, newRecruiter] }));
    return newRecruiter;
  },

  updateRecruiter: async (id: string, updates) => {
    const state = get();
    const recruiter = state.recruiters.find((r) => r.id === id);
    if (!recruiter) return;

    const updated: Recruiter = {
      ...recruiter,
      ...updates,
      updatedAt: Date.now(),
    };
    await storage.saveRecruiter(updated);
    set((state) => ({
      recruiters: state.recruiters.map((r) => (r.id === id ? updated : r)),
    }));
  },

  deleteRecruiter: async (id: string) => {
    const state = get();
    // Unlink recruiter from jobs
    const jobsToUpdate = state.jobs.filter((j) => j.recruiterId === id);

    for (const job of jobsToUpdate) {
      const updated: JobListing = {
        ...job,
        recruiterId: undefined,
        updatedAt: Date.now(),
      };
      await storage.saveJob(updated);
    }

    await storage.deleteRecruiter(id);
    set((state) => ({
      recruiters: state.recruiters.filter((r) => r.id !== id),
      jobs: state.jobs.map((j) =>
        j.recruiterId === id
          ? { ...j, recruiterId: undefined, updatedAt: Date.now() }
          : j,
      ),
    }));
  },

  linkJob: async (recruiterId: string, jobId: string) => {
    const state = get();
    const recruiter = state.recruiters.find((r) => r.id === recruiterId);
    const job = state.jobs.find((j) => j.id === jobId);
    if (!recruiter || !job) return;

    // Update recruiter's linkedJobIds
    if (!recruiter.linkedJobIds.includes(jobId)) {
      const updatedRecruiter: Recruiter = {
        ...recruiter,
        linkedJobIds: [...recruiter.linkedJobIds, jobId],
        updatedAt: Date.now(),
      };
      await storage.saveRecruiter(updatedRecruiter);

      // Update job's recruiterId
      const updatedJob: JobListing = {
        ...job,
        recruiterId,
        updatedAt: Date.now(),
      };
      await storage.saveJob(updatedJob);

      set((state) => ({
        recruiters: state.recruiters.map((r) =>
          r.id === recruiterId ? updatedRecruiter : r,
        ),
        jobs: state.jobs.map((j) => (j.id === jobId ? updatedJob : j)),
      }));
    }
  },

  unlinkJob: async (recruiterId: string, jobId: string) => {
    const state = get();
    const recruiter = state.recruiters.find((r) => r.id === recruiterId);
    const job = state.jobs.find((j) => j.id === jobId);
    if (!recruiter || !job) return;

    const updatedRecruiter: Recruiter = {
      ...recruiter,
      linkedJobIds: recruiter.linkedJobIds.filter((id) => id !== jobId),
      updatedAt: Date.now(),
    };
    await storage.saveRecruiter(updatedRecruiter);

    const updatedJob: JobListing = {
      ...job,
      recruiterId: undefined,
      updatedAt: Date.now(),
    };
    await storage.saveJob(updatedJob);

    set((state) => ({
      recruiters: state.recruiters.map((r) =>
        r.id === recruiterId ? updatedRecruiter : r,
      ),
      jobs: state.jobs.map((j) => (j.id === jobId ? updatedJob : j)),
    }));
  },

  // Resume version actions
  loadResumeVersions: async (resumeId: string) => {
    const versions = await storage.loadResumeVersions(resumeId);
    set((state) => ({
      resumeVersions: {
        ...state.resumeVersions,
        [resumeId]: versions,
      },
    }));
  },

  exportResume: async (resumeId: string, note?: string) => {
    const state = get();
    const resume = state.resumes.find((r) => r.id === resumeId);
    if (!resume) throw new Error("Resume not found");

    const versionNumber = await storage.getNextVersionNumber(resumeId);

    // Deep copy sections
    const sectionsCopy: ResumeSection[] = resume.sections.map((section) => ({
      id: section.id,
      title: section.title,
      content: section.content.map((c) => ({ ...c })),
    }));

    const version: ResumeVersion = {
      id: nanoid(),
      resumeId,
      versionNumber,
      name: resume.name,
      sections: sectionsCopy,
      exportedAt: Date.now(),
      note,
    };

    await storage.saveResumeVersion(version);

    set((state) => ({
      resumeVersions: {
        ...state.resumeVersions,
        [resumeId]: [...(state.resumeVersions[resumeId] || []), version],
      },
    }));

    return version;
  },

  deleteResumeVersion: async (versionId: string, resumeId: string) => {
    await storage.deleteResumeVersion(versionId);
    set((state) => ({
      resumeVersions: {
        ...state.resumeVersions,
        [resumeId]: (state.resumeVersions[resumeId] || []).filter(
          (v) => v.id !== versionId,
        ),
      },
    }));
  },

  // Audit actions
  runAudit: async (resumeId: string) => {
    const state = get();
    const resume = state.resumes.find((r) => r.id === resumeId);
    if (!resume) {
      throw new Error("Resume not found");
    }

    set({ isAuditing: true, auditError: null });

    try {
      const report = await atsAuditor.analyzeResume(resume, state.clauses);

      // Persist score on the resume
      const updatedResume: Resume = {
        ...resume,
        lastAuditScore: report.overallScore,
        lastAuditAt: Date.now(),
      };
      await storage.saveResume(updatedResume);

      set((state) => ({
        auditReports: {
          ...state.auditReports,
          [resumeId]: report,
        },
        resumes: state.resumes.map((r) =>
          r.id === resumeId ? updatedResume : r,
        ),
        isAuditing: false,
        auditError: null,
      }));

      return report;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to run audit";
      set({ isAuditing: false, auditError: errorMessage });
      throw error;
    }
  },

  clearAuditReport: (resumeId: string) => {
    set((state) => {
      const { [resumeId]: _, ...remainingReports } = state.auditReports;
      return {
        auditReports: remainingReports,
        auditError: null,
      };
    });
  },

  exportAuditReport: async (resumeId: string) => {
    const state = get();
    const report = state.auditReports[resumeId];
    if (!report) {
      throw new Error("No audit report found for this resume");
    }

    const resume = state.resumes.find((r) => r.id === resumeId);
    const resumeName = resume?.name || "resume";

    // Create a downloadable JSON file
    const reportData = JSON.stringify(report, null, 2);
    const blob = new Blob([reportData], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    // Create and trigger download
    const link = document.createElement("a");
    link.href = url;
    link.download = `${resumeName}-audit-report-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the URL
    URL.revokeObjectURL(url);
  },

  // Job Match actions
  runJobMatch: async (
    resumeId: string,
    jobDescription: string,
    jobTitle: string,
    jobCompany: string,
    jobId?: string,
  ) => {
    const state = get();
    const resume = state.resumes.find((r) => r.id === resumeId);
    if (!resume) {
      throw new Error("Resume not found");
    }

    set({ isMatchingJob: true, jobMatchError: null });

    try {
      const report = await analyzeJobMatch(
        resume,
        state.clauses,
        jobDescription,
        jobTitle,
        jobCompany,
        jobId,
      );

      // Persist score on the resume
      const updatedResume: Resume = {
        ...resume,
        lastMatchScore: report.overallScore,
        lastMatchJobTitle: jobTitle,
        lastMatchAt: Date.now(),
      };
      await storage.saveResume(updatedResume);

      set((state) => ({
        jobMatchReports: {
          ...state.jobMatchReports,
          [resumeId]: report,
        },
        resumes: state.resumes.map((r) =>
          r.id === resumeId ? updatedResume : r,
        ),
        isMatchingJob: false,
        jobMatchError: null,
      }));

      return report;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to analyze job match";
      set({ isMatchingJob: false, jobMatchError: errorMessage });
      throw error;
    }
  },

  clearJobMatchReport: (resumeId: string) => {
    set((state) => {
      const { [resumeId]: _, ...remainingReports } = state.jobMatchReports;
      return {
        jobMatchReports: remainingReports,
        jobMatchError: null,
      };
    });
  },

  setJobMatchReport: async (resumeId: string, report: JobMatchReport) => {
    const state = get();
    const resume = state.resumes.find((r) => r.id === resumeId);
    if (resume) {
      const updatedResume: Resume = {
        ...resume,
        lastMatchScore: report.overallScore,
        lastMatchJobTitle: report.jobTitle,
        lastMatchAt: Date.now(),
      };
      await storage.saveResume(updatedResume);
      set((state) => ({
        jobMatchReports: {
          ...state.jobMatchReports,
          [resumeId]: report,
        },
        resumes: state.resumes.map((r) =>
          r.id === resumeId ? updatedResume : r,
        ),
      }));
    } else {
      set((state) => ({
        jobMatchReports: {
          ...state.jobMatchReports,
          [resumeId]: report,
        },
      }));
    }
  },

  // Summary library actions
  addSummary: (name: string, text: string) => {
    const entry: SummaryEntry = { id: nanoid(), name, text };
    const updated = [...get().summaries, entry];
    localStorage.setItem("summary-library", JSON.stringify(updated));
    set({ summaries: updated });
    return entry;
  },

  updateSummary: (id: string, name: string, text: string) => {
    const updated = get().summaries.map((s) =>
      s.id === id ? { ...s, name, text } : s,
    );
    localStorage.setItem("summary-library", JSON.stringify(updated));
    set({ summaries: updated });
  },

  deleteSummary: (id: string) => {
    const updated = get().summaries.filter((s) => s.id !== id);
    localStorage.setItem("summary-library", JSON.stringify(updated));
    set({ summaries: updated });
  },
}));
