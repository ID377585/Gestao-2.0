// src/types/import-job.ts
export type ImportJobStatus =
  | "uploaded"
  | "processing"
  | "review"
  | "completed"
  | "error";

export type RecipeImportType =
  | "producao"
  | "montagem"
  | "empratamento"
  | "base"
  | "incompleta";

export interface ImportJob {
  id: string;
  fileName: string;
  fileUrl: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  status: ImportJobStatus;
  totalPages: number;
  detectedRecipes: number;
  createdRecipes: number;
  errors: string[];
  createdAt: string;
  updatedAt: string;
  uploadedBy?: string;
}