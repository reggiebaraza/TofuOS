'use client';

import { useState, useRef } from "react";
import { Star, FileText, Smartphone, Upload, Mic } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

export type StoreType = "play" | "apple";

export interface AddSourcesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddReviews?: (store: StoreType, appPageUrl: string) => void | Promise<void>;
  onAddDocuments?: (files: File[]) => void | Promise<void>;
  onAddAudio?: (files: File[]) => void | Promise<void>;
}

const ACCEPT_DOCUMENTS = ".pdf,.txt,.doc,.docx,.xls,.xlsx";
const ACCEPT_AUDIO = "audio/*,.mp3,.wav,.m4a,.webm,.ogg,.flac,.mpga";

const isValidDocument = (file: File) =>
  /\.(pdf|txt|doc|docx|xls|xlsx)$/i.test(file.name);

const isValidAudio = (file: File) =>
  /\.(mp3|wav|m4a|webm|ogg|flac|mpga)$/i.test(file.name) ||
  file.type.startsWith("audio/");

const AddSourcesModal = ({
  open,
  onOpenChange,
  onAddReviews,
  onAddDocuments,
  onAddAudio,
}: AddSourcesModalProps) => {
  const [reviewsStore, setReviewsStore] = useState<StoreType>("play");
  const [reviewsUrl, setReviewsUrl] = useState("");
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [reviewsSubmitting, setReviewsSubmitting] = useState(false);

  const [documentFiles, setDocumentFiles] = useState<File[]>([]);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [documentsSubmitting, setDocumentsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [audioFiles, setAudioFiles] = useState<File[]>([]);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioSubmitting, setAudioSubmitting] = useState(false);
  const [isAudioDragging, setIsAudioDragging] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const addValidFiles = (files: FileList | File[]) => {
    const list = Array.isArray(files) ? files : Array.from(files);
    const valid = list.filter(isValidDocument);
    setDocumentFiles((prev) => [...prev, ...valid]);
    setDocumentsError(null);
  };

  const addValidAudioFiles = (files: FileList | File[]) => {
    const list = Array.isArray(files) ? files : Array.from(files);
    const valid = list.filter(isValidAudio);
    setAudioFiles((prev) => [...prev, ...valid]);
    setAudioError(null);
  };

  const handleAddReviews = async () => {
    setReviewsError(null);
    const url = reviewsUrl.trim();
    if (!url) {
      setReviewsError("Please enter an app page URL.");
      return;
    }
    const isPlay = url.includes("play.google.com") || reviewsStore === "play";
    const isApple = url.includes("apps.apple.com") || url.includes("itunes.apple.com") || reviewsStore === "apple";
    if (!isPlay && !isApple) {
      setReviewsError("Please enter a valid Play Store or App Store app page URL.");
      return;
    }
    setReviewsSubmitting(true);
    try {
      await onAddReviews?.(reviewsStore, url);
      setReviewsUrl("");
      setReviewsError(null);
      onOpenChange(false);
    } catch (e) {
      setReviewsError(e instanceof Error ? e.message : "Failed to add reviews source");
    } finally {
      setReviewsSubmitting(false);
    }
  };

  const handleDocumentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) addValidFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    addValidFiles(e.dataTransfer.files);
  };

  const removeDocument = (index: number) => {
    setDocumentFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) addValidAudioFiles(files);
    if (audioInputRef.current) audioInputRef.current.value = "";
  };

  const handleAudioDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAudioDragging(true);
  };

  const handleAudioDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAudioDragging(false);
  };

  const handleAudioDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAudioDragging(false);
    addValidAudioFiles(e.dataTransfer.files);
  };

  const removeAudio = (index: number) => {
    setAudioFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddAudio = async () => {
    setAudioError(null);
    if (audioFiles.length === 0) {
      setAudioError("Please select at least one audio file.");
      return;
    }
    setAudioSubmitting(true);
    try {
      await onAddAudio?.(audioFiles);
      setAudioFiles([]);
      onOpenChange(false);
    } catch (e) {
      setAudioError(e instanceof Error ? e.message : "Failed to transcribe audio");
    } finally {
      setAudioSubmitting(false);
    }
  };

  const handleAddDocuments = async () => {
    setDocumentsError(null);
    if (documentFiles.length === 0) {
      setDocumentsError("Please select at least one file (Word, PDF, or Excel).");
      return;
    }
    setDocumentsSubmitting(true);
    try {
      await onAddDocuments?.(documentFiles);
      setDocumentFiles([]);
      onOpenChange(false);
    } catch (e) {
      setDocumentsError(e instanceof Error ? e.message : "Failed to upload documents");
    } finally {
      setDocumentsSubmitting(false);
    }
  };

  const resetOnClose = (open: boolean) => {
    if (!open) {
      setReviewsUrl("");
      setReviewsError(null);
      setDocumentFiles([]);
      setDocumentsError(null);
      setAudioFiles([]);
      setAudioError(null);
      setIsDragging(false);
      setIsAudioDragging(false);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={resetOnClose}>
      <DialogContent className="sm:max-w-md sm:rounded-xl">
        <DialogHeader className="space-y-1.5">
          <DialogTitle className="text-lg">Add sources</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Choose a source type and add app reviews, documents, or audio to your project.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="reviews" className="w-full mt-1">
          <TabsList className="grid w-full grid-cols-3 h-11 rounded-xl p-1 bg-muted/60">
            <TabsTrigger value="reviews" className="flex items-center gap-2 rounded-lg">
              <Star className="w-4 h-4" />
              Reviews
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex items-center gap-2 rounded-lg">
              <FileText className="w-4 h-4" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="audio" className="flex items-center gap-2 rounded-lg">
              <Mic className="w-4 h-4" />
              Audio
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reviews" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Collect app reviews from a Google Play Store or Apple App Store app page.
            </p>
            <div className="space-y-2">
              <Label>Store</Label>
              <RadioGroup
                value={reviewsStore}
                onValueChange={(v) => setReviewsStore(v as StoreType)}
                className="flex gap-4"
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="play" />
                  <Smartphone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">Play Store</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="apple" />
                  <span className="text-sm">App Store</span>
                </label>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reviews-url">App page URL</Label>
              <Input
                id="reviews-url"
                type="url"
                placeholder={
                  reviewsStore === "play"
                    ? "https://play.google.com/store/apps/details?id=..."
                    : "https://apps.apple.com/app/id..."
                }
                value={reviewsUrl}
                onChange={(e) => {
                  setReviewsUrl(e.target.value);
                  setReviewsError(null);
                }}
                className={cn(reviewsError && "border-destructive")}
              />
              {reviewsError && (
                <p className="text-sm text-destructive">{reviewsError}</p>
              )}
            </div>
            <Button
              onClick={handleAddReviews}
              disabled={reviewsSubmitting}
              className="w-full tofu-gradient text-primary-foreground hover:opacity-90"
            >
              {reviewsSubmitting ? "Adding…" : "Add reviews source"}
            </Button>
          </TabsContent>

          <TabsContent value="documents" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Upload PDF, text (.txt), Word (.doc, .docx), or Excel (.xls, .xlsx) files. PDF and .txt content will be read by the AI.
            </p>
            <div className="space-y-2">
              <Label>Files</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_DOCUMENTS}
                multiple
                onChange={handleDocumentSelect}
                className="hidden"
              />
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "rounded-lg border-2 border-dashed transition-colors flex flex-col items-center justify-center gap-2 py-6 px-4 min-h-[120px]",
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-border bg-muted/30 hover:bg-muted/50"
                )}
              >
                <Upload className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center">
                  {isDragging ? "Drop files here" : "Drag and drop files here, or"}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-dashed"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose PDF, text, Word, or Excel files
                </Button>
              </div>
              {documentFiles.length > 0 && (
                <ul className="text-sm space-y-1 mt-2">
                  {documentFiles.map((file, i) => (
                    <li
                      key={`${file.name}-${i}`}
                      className="flex items-center justify-between gap-2 py-1 px-2 rounded bg-muted"
                    >
                      <span className="truncate text-foreground">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeDocument(i)}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        aria-label={`Remove ${file.name}`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {documentsError && (
                <p className="text-sm text-destructive">{documentsError}</p>
              )}
            </div>
            <Button
              onClick={handleAddDocuments}
              disabled={documentFiles.length === 0 || documentsSubmitting}
              className="w-full tofu-gradient text-primary-foreground hover:opacity-90"
            >
              {documentsSubmitting ? "Uploading…" : "Add documents"}
            </Button>
          </TabsContent>

          <TabsContent value="audio" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Upload audio (e.g. interviews, calls). Speech is transcribed with Gemini and used like document content. Max 20 MB per file. Requires GOOGLE_GEMINI_API_KEY.
            </p>
            <div className="space-y-2">
              <Label>Audio files</Label>
              <input
                ref={audioInputRef}
                type="file"
                accept={ACCEPT_AUDIO}
                multiple
                onChange={handleAudioSelect}
                className="hidden"
              />
              <div
                onDragOver={handleAudioDragOver}
                onDragLeave={handleAudioDragLeave}
                onDrop={handleAudioDrop}
                className={cn(
                  "rounded-lg border-2 border-dashed transition-colors flex flex-col items-center justify-center gap-2 py-6 px-4 min-h-[120px]",
                  isAudioDragging
                    ? "border-primary bg-primary/5"
                    : "border-border bg-muted/30 hover:bg-muted/50"
                )}
              >
                <Mic className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center">
                  {isAudioDragging ? "Drop audio here" : "Drag and drop audio, or"}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-dashed"
                  onClick={() => audioInputRef.current?.click()}
                >
                  Choose MP3, WAV, M4A, etc.
                </Button>
              </div>
              {audioFiles.length > 0 && (
                <ul className="text-sm space-y-1 mt-2">
                  {audioFiles.map((file, i) => (
                    <li
                      key={`${file.name}-${i}`}
                      className="flex items-center justify-between gap-2 py-1 px-2 rounded bg-muted"
                    >
                      <span className="truncate text-foreground">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeAudio(i)}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        aria-label={`Remove ${file.name}`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {audioError && (
                <p className="text-sm text-destructive">{audioError}</p>
              )}
            </div>
            <Button
              onClick={handleAddAudio}
              disabled={audioFiles.length === 0 || audioSubmitting}
              className="w-full tofu-gradient text-primary-foreground hover:opacity-90"
            >
              {audioSubmitting ? "Transcribing…" : "Add audio"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AddSourcesModal;
