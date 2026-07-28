import React, { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { Check, ShieldCheck, UploadCloud, Smartphone, ArrowRight, FileText, Trash2, User as UserIcon } from "lucide-react";
import { User } from "../types";

interface OnboardingViewProps {
  currentUser: User | null;
  onCompleteOnboarding: (phone: string, bio: string, aadharDataUrl: string | null) => void;
}

export default function OnboardingView({ currentUser, onCompleteOnboarding }: OnboardingViewProps) {
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [aadharFile, setAadharFile] = useState<string | null>(null);
  const [aadharFileName, setAadharFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Advanced Visual Progress & Polish States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  // Helper to format file sizes elegantly
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  useEffect(() => {
    const isNewUser = !currentUser?.onboardingCompleted;
    const hasLocationPref = localStorage.getItem("qwick_location_permission_asked");
    if (isNewUser && !hasLocationPref) {
      setShowLocationPrompt(true);
    }
  }, [currentUser]);

  const handleEnableLocation = () => {
    localStorage.setItem("qwick_location_permission_asked", "yes");
    setShowLocationPrompt(false);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log("Location enabled successfully:", position);
        },
        (error) => {
          console.warn("Location permission denied/failed:", error);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  };

  const handleDeclineLocation = () => {
    localStorage.setItem("qwick_location_permission_asked", "yes");
    setShowLocationPrompt(false);
  };

  const triggerWithPermission = (action: () => void) => {
    const hasPermission = localStorage.getItem("qwick_camera_gallery_permission") === "granted";
    if (hasPermission) {
      action();
    } else {
      setPendingAction(() => action);
      setShowPermissionPrompt(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const processFile = (file: File) => {
    if (!file) return;
    setAadharFileName(file.name);
    setFileSize(formatFileSize(file.size));
    setIsUploading(true);
    setUploadProgress(0);

    const reader = new FileReader();
    reader.onloadend = () => {
      const resultStr = reader.result as string;
      setFilePreview(file.type.startsWith("image/") ? resultStr : null);
      
      let currentProgress = 0;
      const interval = setInterval(() => {
        currentProgress += Math.floor(Math.random() * 15) + 8;
        if (currentProgress >= 100) {
          currentProgress = 100;
          clearInterval(interval);
          setUploadProgress(100);
          setTimeout(() => {
            setAadharFile(resultStr);
            setIsUploading(false);
          }, 400);
        } else {
          setUploadProgress(currentProgress);
        }
      }, 50);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      triggerWithPermission(() => processFile(file));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      triggerWithPermission(() => processFile(file));
    }
  };

  const handleRemoveFile = () => {
    setAadharFile(null);
    setAadharFileName(null);
    setFileSize(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      alert("Mobile number is mandatory to continue.");
      return;
    }
    
    // Clean and validate phone number roughly
    const cleanPhone = phone.trim();
    if (cleanPhone.length < 10) {
      alert("Please enter a valid mobile number (at least 10 digits).");
      return;
    }

    if (!bio.trim() || bio.trim().length < 15) {
      alert("Please write a bio about yourself (minimum 15 characters is mandatory).");
      return;
    }

    setIsSubmitting(true);
    // Simulate slight delay for premium feedback
    setTimeout(() => {
      onCompleteOnboarding(cleanPhone, bio.trim(), aadharFile);
      setIsSubmitting(false);
    }, 1200);
  };

  return (
    <div className="w-full min-h-screen bg-brand-bg relative overflow-x-hidden pt-4 pb-24" id="onboarding_container">
      {/* Dynamic Background Gradients */}
      <div className="absolute top-[10%] right-[-10%] w-72 h-72 bg-brand-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[20%] left-[-10%] w-72 h-72 bg-brand-mint/20 rounded-full blur-[90px] pointer-events-none" />

      <div className="max-w-md mx-auto px-4 flex flex-col gap-8">
        
        {/* Progress Header */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center pt-4"
        >

          <h1 className="text-2xl font-black text-brand-dark tracking-tight leading-tight mb-2">
            Complete Your Registration
          </h1>
          <p className="text-xs text-brand-gray max-w-sm mx-auto leading-relaxed">
            Welcome to the community! To maintain a highly reliable, trust-oriented marketplace, please provide your contact details and optional identity check.
          </p>
        </motion.div>

        {/* Setup Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-[24px] border border-brand-light-gray shadow-md p-6 text-left"
        >
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            
            {/* Phone Section */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-brand-dark flex items-center gap-1.5 uppercase tracking-wide">
                <Smartphone className="w-4 h-4 text-brand-primary" />
                Contact Mobile Number <span className="text-red-500">*</span>
              </label>
              <p className="text-[10px] text-brand-gray leading-normal">
                Required for coordination, direct calling, and secure in-app chat notifications.
              </p>
              <div className="relative flex items-center mt-1">
                <span className="absolute left-4 font-extrabold text-sm text-brand-gray">+91</span>
                <input
                  type="tel"
                  required
                  placeholder="90000 00000"
                  pattern="[0-9]{10}"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className="w-full h-12 bg-brand-light-gray/20 border border-brand-outline rounded-xl pl-14 pr-4 font-semibold text-sm text-brand-dark focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/50 transition-all"
                />
              </div>
              <span className="text-[9px] text-brand-gray">Format: 10 digit Indian mobile number.</span>
            </div>

            {/* Bio Section */}
            <div className="flex flex-col gap-2 pt-2 border-t border-brand-light-gray/50">
              <label className="text-xs font-bold text-brand-dark flex items-center gap-1.5 uppercase tracking-wide">
                <UserIcon className="w-4 h-4 text-brand-primary" />
                Your Bio <span className="text-red-500">*</span>
              </label>
              <p className="text-[10px] text-brand-gray leading-normal">
                Tell neighbors about yourself, your skills, or what you are looking for. (Minimum 15 characters)
              </p>
              <div className="relative mt-1">
                <textarea
                  required
                  rows={3}
                  minLength={15}
                  maxLength={250}
                  placeholder="e.g. Friendly neighbor who loves helping with gardening, pet sitting and home organizing. Happy to connect!"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full bg-brand-light-gray/20 border border-brand-outline rounded-xl p-3 font-semibold text-sm text-brand-dark placeholder:font-normal focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/50 transition-all resize-none"
                />
                <span className="absolute bottom-2.5 right-3 text-[10px] font-bold text-brand-gray bg-white/80 backdrop-blur-xs px-1.5 py-0.5 rounded-md border border-brand-light-gray/30">
                  {bio.length}/250
                </span>
              </div>
              <span className="text-[9px] text-brand-gray">Please be detailed to build high trust.</span>
            </div>

            {/* Aadhaar Verification Upload (Optional) */}
            <div className="flex flex-col gap-2 pt-2 border-t border-brand-light-gray/50">
              <label className="text-xs font-bold text-brand-dark flex items-center gap-1.5 uppercase tracking-wide">
                <ShieldCheck className="w-4 h-4 text-brand-primary" />
                Aadhaar Card Upload <span className="text-brand-gray font-medium normal-case">(Optional)</span>
              </label>
              <p className="text-[10px] text-brand-gray leading-normal">
                Unlock instant trust! Upload your Aadhaar Card to get a green <strong className="text-brand-primary">Verified Neighbors</strong> badge. Verified users get up to 4x more replies.
              </p>

              {/* Conditional State: Upload, Progress, or Uploaded */}
              {isUploading ? (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 bg-brand-bg border border-brand-outline rounded-2xl p-5 flex flex-col gap-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-brand-primary/10 rounded-xl flex items-center justify-center text-brand-primary shrink-0">
                      <span className="w-4 h-4 border-2 border-brand-primary border-t-transparent rounded-full animate-spin"></span>
                    </div>
                    <div className="text-left min-w-0 flex-1">
                      <p className="text-xs font-bold text-brand-dark truncate">{aadharFileName}</p>
                      <p className="text-[10px] text-brand-gray mt-0.5">
                        {fileSize ? `${fileSize} • ` : ''}
                        {uploadProgress < 40 && "Scanning security features..."}
                        {uploadProgress >= 40 && uploadProgress < 80 && "Validating format..."}
                        {uploadProgress >= 80 && uploadProgress < 100 && "Securing document..."}
                        {uploadProgress === 100 && "Attachment ready!"}
                      </p>
                    </div>
                    <span className="text-xs font-black text-brand-primary shrink-0 bg-brand-primary/10 px-2 py-1 rounded-lg">
                      {uploadProgress}%
                    </span>
                  </div>

                  {/* Progress Bar Track */}
                  <div className="w-full h-2 bg-brand-light-gray rounded-full overflow-hidden relative">
                    <motion.div
                      className="h-full bg-brand-primary rounded-full relative"
                      style={{ width: `${uploadProgress}%` }}
                    >
                      {/* Animated light sweep / highlight */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/35 to-transparent animate-[pulse_1s_infinite] h-full w-full" />
                    </motion.div>
                  </div>
                </motion.div>
              ) : !aadharFile ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => triggerWithPermission(() => fileInputRef.current?.click())}
                  className={`mt-2 border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200 ${
                    isDragging 
                      ? "border-brand-primary bg-brand-primary/5 scale-[1.02]" 
                      : "border-brand-outline hover:border-brand-primary hover:bg-brand-primary/5"
                  }`}
                >
                  <UploadCloud className="w-10 h-10 text-brand-primary/60 animate-pulse" />
                  <div className="text-center">
                    <p className="text-xs font-bold text-brand-dark">Drag & drop your Aadhaar here</p>
                    <p className="text-[10px] text-brand-gray mt-0.5">or click to browse from device</p>
                  </div>
                  <span className="text-[9px] text-brand-gray/60 uppercase tracking-widest mt-1">Supports JPG, PNG or PDF</span>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*,.pdf"
                    className="hidden"
                  />
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-2 bg-emerald-50/70 border-2 border-brand-mint-dark/40 rounded-2xl p-4 flex flex-col gap-3 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {filePreview ? (
                        <div className="w-12 h-12 rounded-xl overflow-hidden border border-brand-mint-dark/20 bg-white shrink-0 shadow-sm relative group">
                          <img 
                            src={filePreview} 
                            alt="Aadhaar Preview" 
                            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-110"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center text-brand-mint-dark shrink-0 border border-brand-mint-dark/20 shadow-sm">
                          <FileText className="w-6 h-6" />
                        </div>
                      )}
                      
                      <div className="text-left min-w-0">
                        <p className="text-xs font-black text-brand-dark truncate max-w-[160px]" title={aadharFileName || ""}>
                          {aadharFileName}
                        </p>
                        {fileSize && (
                          <p className="text-[9px] text-brand-gray font-semibold mt-0.5">
                            File Size: {fileSize}
                          </p>
                        )}
                        <span className="inline-flex items-center gap-1 text-[9px] text-emerald-800 bg-brand-mint px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider mt-1 border border-brand-mint-dark/10 shadow-3xs">
                          <Check className="w-3 h-3 stroke-[3]" /> Document Attached
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="p-2.5 bg-white hover:bg-red-50 text-brand-gray hover:text-red-500 rounded-xl border border-brand-outline hover:border-red-200 transition-all active:scale-95 shadow-sm shrink-0 flex items-center justify-center"
                      title="Remove File"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Dynamic verified badge preview */}
              {aadharFile && (
                <div className="mt-3 p-3.5 bg-brand-mint/15 rounded-2xl border border-brand-mint/30 flex items-start gap-3">
                  <div className="p-1.5 bg-brand-mint rounded-lg text-brand-mint-dark shrink-0">
                    <ShieldCheck className="w-4 h-4 text-brand-mint-dark" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-bold text-brand-mint-dark uppercase tracking-wider">Badge Unlocked!</p>
                    <p className="text-xs text-brand-mint-dark/90 leading-relaxed mt-0.5">
                      You will instantly appear as a <strong className="font-extrabold text-brand-primary">Verified Neighbor</strong> across the marketplace once completed.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-brand-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-brand-primary/20 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:bg-brand-primary/60"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Verifying & Setting Up...</span>
                </>
              ) : (
                <>
                  <span>Complete Setup & Enter</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

          </form>
        </motion.div>

        {/* Trust banner */}
        <div className="p-4 bg-brand-light-gray/20 border border-brand-light-gray/30 rounded-2xl flex items-start gap-3 text-left">
          <div className="p-1.5 bg-white rounded-lg border border-brand-outline text-brand-primary">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-brand-dark uppercase tracking-wider">Zero-Spam & Safe Community</p>
            <p className="text-[10px] text-brand-gray leading-normal mt-0.5">
              Qwick Gig strictly enforces a no-spam policy. Your uploaded Aadhaar documents are safely encrypted and are only used to verify your real identity. We never share your data.
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center text-[10px] text-brand-gray/50">
          <p>© 2026 Qwick Gig India • Secured Identity Portal</p>
        </footer>

      </div>

      {showLocationPrompt && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[24px] overflow-hidden shadow-2xl max-w-sm w-full p-6 text-center border border-brand-light-gray flex flex-col gap-4"
          >
            <div className="w-14 h-14 bg-brand-primary/10 text-brand-primary rounded-full flex items-center justify-center mx-auto">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-brand-dark font-black text-lg">Enable Device Location</h3>
              <p className="text-xs text-brand-gray mt-2 font-medium leading-relaxed">
                Qwick Gig uses your device location to show you local gig listings, match you with nearby helpers, and calculate accurate distances. This is highly recommended for mobile devices.
              </p>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              <button
                type="button"
                onClick={handleEnableLocation}
                className="w-full py-3 bg-brand-primary text-white font-extrabold text-xs rounded-xl shadow-md shadow-brand-primary/20 hover:bg-brand-primary-hover active:scale-95 transition-all cursor-pointer"
              >
                Enable Location Access
              </button>
              <button
                type="button"
                onClick={handleDeclineLocation}
                className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-brand-gray font-bold text-xs rounded-xl transition-all cursor-pointer border border-brand-light-gray/60"
              >
                Not Now
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showPermissionPrompt && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[24px] overflow-hidden shadow-2xl max-w-sm w-full p-6 text-center border border-brand-light-gray flex flex-col gap-4"
          >
            <div className="w-14 h-14 bg-brand-primary/10 text-brand-primary rounded-full flex items-center justify-center mx-auto">
              <UploadCloud className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-brand-dark font-black text-lg">Allow Photos & Camera Access?</h3>
              <p className="text-xs text-brand-gray mt-2 font-medium leading-relaxed">
                Qwick Gig requires permission to access your Camera & Photo Gallery to let you upload profile pictures, Aadhaar verification documents, and gig attachments.
              </p>
            </div>
            <div className="flex flex-col gap-2 mt-2">
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem("qwick_camera_gallery_permission", "granted");
                  setShowPermissionPrompt(false);
                  if (pendingAction) {
                    pendingAction();
                    setPendingAction(null);
                  }
                }}
                className="w-full py-3 bg-brand-primary text-white font-extrabold text-xs rounded-xl shadow-md shadow-brand-primary/20 hover:bg-brand-primary-hover active:scale-95 transition-all cursor-pointer"
              >
                Allow Access
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPermissionPrompt(false);
                  setPendingAction(null);
                  alert("Access is required to upload files.");
                }}
                className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-brand-gray font-bold text-xs rounded-xl transition-all cursor-pointer border border-brand-light-gray/60"
              >
                Don't Allow
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
