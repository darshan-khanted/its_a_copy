import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Camera, ShieldCheck, Eye, EyeOff, LogOut, Save, MapPin, Trash2, Edit2, CheckCircle2, UploadCloud, FileText, Image, X, ShieldAlert, History, ArrowLeft, User as UserIcon, HelpCircle, XCircle, Loader2, Database, Users, Briefcase, Clock, ArrowUpDown, Check, Ban, MessageSquare, Star, Send, Mail } from 'lucide-react';
import { User, Gig, Review, getUserAvatarUrl } from '../types';
import { formatToDDMMYY, formatTimestampToDDMMYY } from '../utils/date';
import { toTitleCase } from '../utils/stringUtils';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import CameraCaptureModal from './CameraCaptureModal';
import FaqAccordion from './FaqAccordion';
import { uploadFileWithFallback, db, collection, getDocs, updateDoc, doc, setDoc, query, where, handleFirestoreError, OperationType, auth } from '../firebase';
import { EmailAuthProvider, linkWithCredential, updatePassword } from 'firebase/auth';

interface ProfileViewProps {
  currentUser: User | null;
  userGigs?: Gig[];
  allGigs?: Gig[];
  onSelectGig?: (gig: Gig) => void;
  onToggleGigStatus?: (gigId: string, isClosed: boolean) => void;
  onUpdateGig?: (gigId: string, updates: Partial<Gig>) => void;
  onLogIn: (user: User, isSignUp?: boolean, password?: string, googleCredentialToken?: string) => void;
  onLogOut: () => void;
  onUpdateProfile: (updated: User) => void;
  reviews?: Review[];
  onCancelGig?: (gigId: string) => Promise<void>;
  onResetPassword?: (email: string) => Promise<void>;
}

export default function ProfileView({ 
  currentUser, 
  userGigs = [],
  allGigs = [],
  onSelectGig,
  onToggleGigStatus,
  onUpdateGig,
  onLogIn, 
  onLogOut, 
  onUpdateProfile,
  reviews = [],
  onCancelGig,
  onResetPassword
}: ProfileViewProps) {
  const liveGigs = userGigs.filter(gig => !gig.isClosed && gig.status !== 'Cancelled' && gig.status !== 'Completed');
  const historyGigs = userGigs.filter(gig => gig.isClosed || gig.status === 'Cancelled' || gig.status === 'Completed');
  const actualCompletedGigsDone = allGigs.filter(gig => 
    currentUser && 
    (gig.selectedWorker?.email === currentUser.email || gig.acceptedByEmail === currentUser.email) &&
    (gig.status === 'Completed' || gig.status === 'Cancelled' || gig.isClosed)
  );

  useEffect(() => {
    if (currentUser) {
      const actualGigsPosted = historyGigs.length;
      const actualGigsDone = actualCompletedGigsDone.length;
      if (
        currentUser.gigsPosted !== actualGigsPosted ||
        currentUser.gigsDone !== actualGigsDone
      ) {
        onUpdateProfile({
          ...currentUser,
          gigsPosted: actualGigsPosted,
          gigsDone: actualGigsDone
        });
      }
    }
  }, [historyGigs.length, actualCompletedGigsDone.length, currentUser, onUpdateProfile]);

  const [isEditing, setIsEditing] = useState(false);
  const [editingGigId, setEditingGigId] = useState<string | null>(null);
  const [cancellingGigId, setCancellingGigId] = useState<string | null>(null);
  const [activeProfileTab, setActiveProfileTab] = useState<'main' | 'live-gigs' | 'gig-history' | 'personal-info' | 'reviews' | 'saved-addresses' | 'faq' | 'app-feedback' | 'gigs-done' | 'gigs-posted'>('main');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');

  // App Feedback States
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackCategory, setFeedbackCategory] = useState<'Bug Report' | 'Feature Suggestion' | 'General Experience' | 'Praise'>('Feature Suggestion');
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackFileUrl, setFeedbackFileUrl] = useState('');
  const [isFeedbackUploading, setIsFeedbackUploading] = useState(false);
  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false);
  const [pastFeedbacks, setPastFeedbacks] = useState<any[]>([]);
  const [isLoadingPastFeedbacks, setIsLoadingPastFeedbacks] = useState(false);

  const feedbackFileInputRef = useRef<HTMLInputElement>(null);

  const loadPastFeedbacks = async () => {
    if (!currentUser) return;
    setIsLoadingPastFeedbacks(true);
    try {
      const q = query(
        collection(db, "app_feedback"),
        where("userEmail", "==", currentUser.email)
      );
      const snapshot = await getDocs(q);
      const list: any[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...(doc.data() as any) });
      });
      // Sort by createdAt descending
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setPastFeedbacks(list);
    } catch (err) {
      console.error("Error loading past feedback:", err);
      handleFirestoreError(err, OperationType.GET, "app_feedback");
    } finally {
      setIsLoadingPastFeedbacks(false);
    }
  };

  useEffect(() => {
    if (activeProfileTab === 'app-feedback' && currentUser) {
      loadPastFeedbacks();
    }
  }, [activeProfileTab, currentUser]);

  const handleFeedbackFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && currentUser) {
      triggerWithPermission(() => {
        setIsFeedbackUploading(true);
        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = reader.result as string;
          try {
            const uploadedUrl = await uploadFileWithFallback(dataUrl, "gig", currentUser.email);
            setFeedbackFileUrl(uploadedUrl);
          } catch (err) {
            console.error("Error uploading feedback attachment:", err);
            setFeedbackFileUrl(dataUrl);
          } finally {
            setIsFeedbackUploading(false);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackComment.trim()) {
      alert("Please provide some feedback details.");
      return;
    }
    if (!currentUser) return;

    setIsFeedbackSubmitting(true);
    try {
      const feedbackId = doc(collection(db, "app_feedback")).id;
      const payload = {
        userEmail: currentUser.email,
        userName: currentUser.fullName,
        userAvatar: currentUser.avatar,
        rating: feedbackRating,
        category: feedbackCategory,
        comment: feedbackComment.trim(),
        screenshotUrl: feedbackFileUrl,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, "app_feedback", feedbackId), payload);
      
      // Clear form
      setFeedbackComment("");
      setFeedbackRating(5);
      setFeedbackCategory("Feature Suggestion");
      setFeedbackFileUrl("");
      
      alert("Thank you! Your feedback has been successfully submitted directly to the Qwick Gig team. We appreciate your input!");
      
      // Refresh list
      loadPastFeedbacks();
    } catch (err) {
      console.error("Error submitting app feedback:", err);
      handleFirestoreError(err, OperationType.WRITE, "app_feedback");
    } finally {
      setIsFeedbackSubmitting(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      alert('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      alert('Passwords do not match.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        alert('You must be logged in to set/change password.');
        return;
      }

      const userProviders = firebaseUser.providerData.map(p => p.providerId);
      const isGoogle = userProviders.includes('google.com');
      const isEmailPass = userProviders.includes('password');

      if (isEmailPass) {
        // Just update existing password
        await updatePassword(firebaseUser, newPassword);
        alert('Password updated successfully!');
      } else if (isGoogle) {
        // Link Google user with EmailAuthProvider
        const credential = EmailAuthProvider.credential(firebaseUser.email || '', newPassword);
        await linkWithCredential(firebaseUser, credential);
        alert('Password login successfully added to your Google account! You can now sign in with either method.');
      } else {
        alert('No compatible login provider found.');
      }

      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: any) {
      console.error("Error setting/updating password:", err);
      alert(err.message || 'Failed to update/set password. If it has been a long time since you signed in, please log out and sign in again to perform this sensitive action.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const [signinEmail, setSigninEmail] = useState('');
  const [signinPassword, setSigninPassword] = useState('');
  const [pendingPassword, setPendingPassword] = useState('');
  const [signinName, setSigninName] = useState('');
  const [signinPhone, setSigninPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isAadharUploading, setIsAadharUploading] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [showPhotoSourceOptions, setShowPhotoSourceOptions] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [pendingUserToLogin, setPendingUserToLogin] = useState<User | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aadharInputRef = useRef<HTMLInputElement>(null);

  const triggerWithPermission = (action: () => void) => {
    const hasPermission = localStorage.getItem("qwick_camera_gallery_permission") === "granted";
    if (hasPermission) {
      action();
    } else {
      setPendingAction(() => action);
      setShowPermissionPrompt(true);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && currentUser) {
      triggerWithPermission(() => {
        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = reader.result as string;
          try {
            const uploadedUrl = await uploadFileWithFallback(dataUrl, "avatar", currentUser.email);
            onUpdateProfile({
              ...currentUser,
              avatar: uploadedUrl
            });
          } catch (err) {
            console.error("Error uploading avatar:", err);
            onUpdateProfile({ ...currentUser, avatar: dataUrl });
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionLabel: string;
    actionColor: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    actionLabel: '',
    actionColor: '',
    onConfirm: () => {}
  });

  // Saved Addresses State
  const [savedAddresses, setSavedAddresses] = useState<
    { type: string; address: string; suburb: string; door?: string; customName?: string }[]
  >([]);

  // Inline Saved Address Form State
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [addrType, setAddrType] = useState('Home');
  const [addrCustomName, setAddrCustomName] = useState('');
  const [addrDoor, setAddrDoor] = useState('');
  const [addrAddress, setAddrAddress] = useState('');
  const [addrSuburb, setAddrSuburb] = useState('');

  const handleInlineSaveAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrAddress.trim() || !addrSuburb.trim()) {
      alert('Please fill out Address and Suburb / PIN Code.');
      return;
    }

    const type = addrType;
    const finalName = type === 'Other' ? (addrCustomName.trim() || 'Other') : type;
    const finalSuburb = addrSuburb.trim();
    const finalDoor = addrDoor.trim();
    const address = addrAddress.trim();

    if (type === 'Other') {
      localStorage.setItem('qwick_saved_Other_name', finalName);
    }
    localStorage.setItem(`qwick_saved_${type}`, address);
    localStorage.setItem(`qwick_saved_${type}_suburb`, finalSuburb);
    localStorage.setItem(`qwick_saved_${type}_door`, finalDoor);

    // reset fields
    setAddrCustomName('');
    setAddrDoor('');
    setAddrAddress('');
    setAddrSuburb('');
    setIsAddingAddress(false);

    // reload
    loadSavedAddresses();
  };

  const loadSavedAddresses = () => {
    const list = [];
    const types = ['Home', 'Work', 'Other'];
    for (const t of types) {
      const address = localStorage.getItem(`qwick_saved_${t}`);
      if (address) {
        list.push({
          type: t,
          address,
          suburb: localStorage.getItem(`qwick_saved_${t}_suburb`) || '',
          door: localStorage.getItem(`qwick_saved_${t}_door`) || '',
          customName: t === 'Other' ? (localStorage.getItem(`qwick_saved_Other_name`) || 'Other') : t,
        });
      }
    }
    setSavedAddresses(list);
  };

  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.fullName);
      setEmail(currentUser.email);
      setPhone(currentUser.phoneNumber || '');
      setBio(currentUser.bio || '');
      loadSavedAddresses();
    }
  }, [currentUser]);

  const handleDeleteAddress = (type: string) => {
    localStorage.removeItem(`qwick_saved_${type}`);
    localStorage.removeItem(`qwick_saved_${type}_suburb`);
    localStorage.removeItem(`qwick_saved_${type}_door`);
    if (type === 'Other') {
      localStorage.removeItem(`qwick_saved_Other_name`);
    }
    loadSavedAddresses();
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      alert('Please fill out all fields.');
      return;
    }
    if (currentUser) {
      onUpdateProfile({
        ...currentUser,
        fullName: toTitleCase(fullName.trim()),
        email: email.trim(),
        phoneNumber: phone.trim(),
        bio: bio.trim()
      });
      setIsEditing(false);
      alert('Profile updated successfully!');
    }
  };

  const handleEmailAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isForgotPassword) {
      if (!signinEmail.trim()) {
        alert('Please enter your email address.');
        return;
      }
      if (onResetPassword) {
        onResetPassword(signinEmail.trim());
      }
      return;
    }

    if (!signinEmail.trim() || !signinPassword.trim()) {
      alert('Please fill out all fields.');
      return;
    }
    if (isSignUp && !signinName.trim()) {
      alert('Please fill out your full name.');
      return;
    }

    const emailToUse = signinEmail.trim();
    const nameToUse = isSignUp ? signinName.trim() : emailToUse.split('@')[0];

    const finalUser: User = {
      fullName: nameToUse,
      email: emailToUse,
      phoneNumber: '',
      isVerified: false,
      avatar: getUserAvatarUrl('', emailToUse, nameToUse),
      gigsDone: 0,
      gigsPosted: 0
    };

    if (isSignUp) {
      setPendingPassword(signinPassword);
      setPendingUserToLogin(finalUser);
      setShowLocationPrompt(true);
    } else {
      onLogIn(finalUser, false, signinPassword);
    }
  };

  if (!currentUser) {
    return (
      <>
        <div className="w-full max-w-md mx-auto my-12" id="login_container">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[24px] border border-brand-light-gray shadow-lg overflow-hidden p-8"
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl font-extrabold text-brand-dark tracking-tight">
                {isForgotPassword 
                  ? 'Reset Your Password' 
                  : isSignUp 
                    ? 'Create Your Account' 
                    : 'Welcome to Qwick Gig'}
              </h2>
              <p className="text-brand-gray text-sm mt-1.5">
                {isForgotPassword 
                  ? 'Enter your email and we will send you a secure password reset link to access your account.' 
                  : isSignUp 
                    ? 'Sign up to find local work or post gigs near you.' 
                    : 'Sign in to find local work or post gigs near you.'}
              </p>
            </div>

            <form onSubmit={handleEmailAuthSubmit} className="flex flex-col gap-4">
              {isSignUp && !isForgotPassword && (
                <>
                  <div className="flex flex-col gap-1.5 text-left">
                    <label className="text-xs font-bold text-brand-dark">Full Name</label>
                    <input
                      type="text"
                      placeholder="John Doe"
                      value={signinName}
                      onChange={(e) => setSigninName(e.target.value)}
                      className="h-11 bg-brand-light-gray/20 border border-brand-outline focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/50 rounded-xl px-4 text-xs font-semibold focus:outline-none transition-all text-brand-dark"
                    />
                  </div>
                </>
              )}

              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-bold text-brand-dark">Email Address</label>
                <input
                  type="email"
                  placeholder="example@gmail.com"
                  value={signinEmail}
                  onChange={(e) => setSigninEmail(e.target.value)}
                  className="h-11 bg-brand-light-gray/20 border border-brand-outline focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/50 rounded-xl px-4 text-xs font-semibold focus:outline-none transition-all text-brand-dark"
                  required
                />
              </div>

              {!isForgotPassword && (
                <div className="flex flex-col gap-1.5 text-left relative">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-brand-dark">Password</label>
                    {!isSignUp && (
                      <button
                        type="button"
                        onClick={() => setIsForgotPassword(true)}
                        className="text-[11px] text-brand-primary hover:underline font-bold focus:outline-none"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={signinPassword}
                      onChange={(e) => setSigninPassword(e.target.value)}
                      className="w-full h-11 bg-brand-light-gray/20 border border-brand-outline focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/50 rounded-xl pl-4 pr-11 text-xs font-semibold focus:outline-none transition-all text-brand-dark"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-gray hover:text-brand-dark p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="h-11 bg-brand-primary hover:bg-brand-primary-hover text-white font-extrabold text-xs rounded-xl shadow-md shadow-brand-primary/20 active:scale-[0.98] transition-all flex items-center justify-center cursor-pointer mt-2"
              >
                {isForgotPassword 
                  ? 'Send Reset Link' 
                  : isSignUp 
                    ? 'Create Account' 
                    : 'Sign In'}
              </button>
            </form>

            {isForgotPassword ? (
              <div className="text-center mt-6">
                <button
                  type="button"
                  onClick={() => setIsForgotPassword(false)}
                  className="text-brand-primary hover:underline text-xs font-bold"
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <>
                <div className="my-5 flex items-center justify-center gap-3">
                  <div className="h-px bg-brand-outline flex-1"></div>
                  <span className="text-[10px] text-brand-gray font-bold uppercase tracking-wider">or</span>
                  <div className="h-px bg-brand-outline flex-1"></div>
                </div>

                <div className="flex justify-center w-full mt-2">
                  {!import.meta.env.VITE_GOOGLE_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID === 'dummy-client-id' ? (
                    <div className="p-3 bg-red-50 text-red-600 rounded text-xs text-center border border-red-200">
                      Google Client ID is missing. Please add VITE_GOOGLE_CLIENT_ID to your secrets.
                    </div>
                  ) : !import.meta.env.VITE_GOOGLE_CLIENT_ID.endsWith('.apps.googleusercontent.com') ? (
                    <div className="p-3 bg-yellow-50 text-yellow-800 rounded text-xs text-center border border-yellow-200">
                      <span className="font-semibold block mb-1">Invalid Client ID format</span>
                      The value you entered for GOOGLE_CLIENT_ID does not look like a valid Client ID. 
                      It should end with <code>.apps.googleusercontent.com</code>.<br/><br/>
                      Current value starts with: {import.meta.env.VITE_GOOGLE_CLIENT_ID?.substring(0, 15)}...<br/><br/>
                      Are you sure you didn't paste the <strong>Client secret</strong> instead? You need the <strong>Client ID</strong>.
                    </div>
                  ) : (
                    <GoogleLogin
                      onSuccess={(credentialResponse) => {
                        if (credentialResponse.credential) {
                          try {
                            const decoded = jwtDecode(credentialResponse.credential) as any;
                            const finalUser: User = {
                              fullName: decoded.name || 'Google User',
                              email: decoded.email || 'user@gmail.com',
                              phoneNumber: '',
                              isVerified: false,
                              avatar: getUserAvatarUrl(decoded.picture, decoded.email, decoded.name),
                              gigsDone: 0,
                              gigsPosted: 0
                            };
                            onLogIn(finalUser, undefined, undefined, credentialResponse.credential);
                          } catch (e) {
                            console.error(e);
                          }
                        }
                      }}
                      onError={() => {
                        alert('Google Sign In Failed. Please try again.');
                      }}
                    />
                  )}
                </div>

                <div className="text-center mt-6">
                  <button
                    type="button"
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-brand-primary hover:underline text-xs font-bold"
                  >
                    {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Create one"}
                  </button>
                </div>
              </>
            )}
          </motion.div>
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
                  onClick={() => {
                    localStorage.setItem("qwick_location_permission_asked", "yes");
                    setShowLocationPrompt(false);
                    if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition(
                        (position) => {
                          console.log("Location enabled successfully:", position);
                          if (pendingUserToLogin) {
                            onLogIn(pendingUserToLogin, true, pendingPassword);
                            setPendingUserToLogin(null);
                            setPendingPassword('');
                          }
                        },
                        (error) => {
                          console.warn("Location permission denied/failed:", error);
                          if (pendingUserToLogin) {
                            onLogIn(pendingUserToLogin, true, pendingPassword);
                            setPendingUserToLogin(null);
                            setPendingPassword('');
                          }
                        },
                        { enableHighAccuracy: true, timeout: 5000 }
                      );
                    } else {
                      if (pendingUserToLogin) {
                        onLogIn(pendingUserToLogin, true, pendingPassword);
                        setPendingUserToLogin(null);
                        setPendingPassword('');
                      }
                    }
                  }}
                  className="w-full py-3 bg-brand-primary text-white font-extrabold text-xs rounded-xl shadow-md shadow-brand-primary/20 hover:bg-brand-primary-hover active:scale-[0.98] transition-all cursor-pointer"
                >
                  Enable Location Access
                </button>
                <button
                  type="button"
                  onClick={() => {
                    localStorage.setItem("qwick_location_permission_asked", "yes");
                    setShowLocationPrompt(false);
                    if (pendingUserToLogin) {
                      onLogIn(pendingUserToLogin, true, pendingPassword);
                      setPendingUserToLogin(null);
                      setPendingPassword('');
                    }
                  }}
                  className="w-full py-3 bg-slate-50 hover:bg-slate-100 text-brand-gray font-bold text-xs rounded-xl transition-all cursor-pointer border border-brand-light-gray/60"
                >
                  Not Now
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </>
    );
  }



  if (activeProfileTab === 'saved-addresses') {
    return (
      <div className="w-full max-w-2xl mx-auto my-3 flex flex-col animate-in fade-in duration-200 bg-white rounded-3xl border border-brand-light-gray/80 shadow-md p-6 text-left" id="profile_panel">
        <div className="flex items-center gap-2 mb-6 pb-2 border-b border-brand-light-gray/30">
          <button 
            type="button"
            onClick={() => setActiveProfileTab('main')}
            className="p-1.5 mr-1 hover:bg-brand-light-gray/20 border border-brand-light-gray/80 rounded-lg shadow-sm text-brand-dark hover:text-brand-primary transition-all flex items-center justify-center cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-lg">📍</span>
          <span className="font-extrabold text-lg text-brand-dark">Saved Addresses</span>
          <span className="bg-brand-light-gray/40 text-brand-gray text-xs px-2.5 py-0.5 rounded-full font-black ml-auto">
            {savedAddresses.length} Saved
          </span>
        </div>

        {savedAddresses.length === 0 ? (
          <div className="text-center py-16 px-4">
            <span className="text-5xl block mb-4 opacity-75">🗺️</span>
            <p className="text-sm font-bold text-brand-dark">No saved addresses</p>
            <p className="text-xs text-brand-gray mt-2 max-w-xs mx-auto leading-relaxed">
              You can save and manage your locations here. They are used to quickly set gig locations and find helpers in your area.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {savedAddresses.map((addr) => (
              <div key={addr.type} className="flex justify-between items-center p-4 bg-brand-bg/50 rounded-2xl border border-brand-light-gray/50 hover:bg-brand-bg transition-colors duration-200">
                <div className="flex flex-col">
                  <span className="font-extrabold text-brand-dark text-xs">{addr.customName}</span>
                  <span className="text-[11px] text-brand-gray mt-1 leading-relaxed">
                    {addr.door ? addr.door + ', ' : ''}{addr.address}  
                  </span>
                  <span className="text-[11px] text-brand-primary font-bold mt-1">{addr.suburb}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteAddress(addr.type)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0 border border-transparent hover:border-red-100"
                  title="Delete Address"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (activeProfileTab === 'faq') {
    return (
      <div className="w-full max-w-2xl mx-auto my-3 flex flex-col animate-in fade-in duration-200 bg-white rounded-3xl border border-brand-light-gray/80 shadow-md p-6 text-left" id="profile_panel">
        <div className="flex items-center gap-2 mb-6 pb-2 border-b border-brand-light-gray/30">
          <button 
            type="button"
            onClick={() => setActiveProfileTab('main')}
            className="p-1.5 mr-1 hover:bg-brand-light-gray/20 border border-brand-light-gray/80 rounded-lg shadow-sm text-brand-dark hover:text-brand-primary transition-all flex items-center justify-center cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="font-extrabold text-base text-brand-dark">Help & FAQs</span>
        </div>
        <div className="flex flex-col gap-4 mt-2">
          <p className="text-xs text-brand-gray leading-relaxed mb-2 font-medium">
            Got questions about how Qwick Gig works? Browse our most common queries below. Tap on any question to expand its answer.
          </p>
          <FaqAccordion />

          <div className="mt-6 pt-6 border-t border-brand-light-gray/30 text-center flex flex-col items-center gap-2">
            <span className="font-extrabold text-sm text-brand-dark">Still need help?</span>
            <p className="text-xs text-brand-gray">
              We're here to support you! Get in touch with our team directly:
            </p>
            <a 
              href="mailto:support@qwickgig.com"
              className="mt-1 font-bold text-xs text-brand-primary hover:underline flex items-center gap-1.5 bg-brand-primary/5 hover:bg-brand-primary/10 px-4 py-2 rounded-full transition-all border border-brand-primary/10"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>support@qwickgig.com</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (activeProfileTab === 'reviews') {
    const userReviews = reviews.filter((r) => r.targetEmail === (currentUser?.email || ""));
    return (
      <div className="w-full max-w-2xl mx-auto my-3 flex flex-col animate-in fade-in duration-200 bg-white rounded-3xl border border-brand-light-gray/80 shadow-md p-6 text-left" id="profile_panel">
        <div className="flex items-center gap-2 mb-6 pb-2 border-b border-brand-light-gray/30">
          <button 
            type="button"
            onClick={() => setActiveProfileTab('main')}
            className="p-1.5 mr-1 hover:bg-brand-light-gray/20 border border-brand-light-gray/80 rounded-lg shadow-sm text-brand-dark hover:text-brand-primary transition-all flex items-center justify-center cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-lg">⭐</span>
          <span className="font-extrabold text-lg text-brand-dark">Feedbacks</span>
          <span className="bg-brand-light-gray/40 text-brand-gray text-xs px-2.5 py-0.5 rounded-full font-black ml-auto">
            {userReviews.length} Reviews
          </span>
        </div>

        {userReviews.length === 0 ? (
          <div className="text-center py-16 px-4">
            <span className="text-5xl block mb-4 opacity-75">✍️</span>
            <p className="text-sm font-bold text-brand-dark">No feedback received yet</p>
            <p className="text-xs text-brand-gray mt-2 max-w-xs mx-auto leading-relaxed">
              Once other users rate you after collaborating on gigs, their real, verified reviews will appear here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 max-h-[500px] overflow-y-auto pr-1">
            {userReviews.map((rev) => (
              <div key={rev.id} className="flex flex-col gap-2.5 text-xs bg-brand-bg/30 border border-brand-light-gray/50 p-4 rounded-2xl">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={getUserAvatarUrl(rev.reviewerAvatar, rev.reviewerEmail, rev.reviewerName)}
                      alt={rev.reviewerName}
                      className="w-8 h-8 rounded-full object-cover border border-brand-light-gray/50"
                    />
                    <div>
                      <span className="font-bold text-brand-dark block text-xs">{rev.reviewerName}</span>
                      <span className="text-[10px] text-brand-gray/60 block mt-0.5">
                        {formatTimestampToDDMMYY(rev.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex text-[#e2c62d] bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <span key={idx} className="text-xs">
                        {idx < rev.rating ? "★" : "☆"}
                      </span>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-brand-dark leading-relaxed italic bg-white p-3 rounded-xl border border-brand-light-gray/35">
                  "{rev.comment}"
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (activeProfileTab === 'live-gigs') {
    return (
      <div className="w-full max-w-2xl mx-auto my-3 flex flex-col animate-in fade-in duration-200 bg-white rounded-3xl border border-brand-light-gray/80 shadow-md p-6" id="profile_panel">
        <div className="flex items-center gap-2 mb-6 pb-2 border-b border-brand-light-gray/30">
          <button 
            onClick={() => setActiveProfileTab('main')}
            className="p-1.5 mr-1 hover:bg-brand-light-gray/20 border border-brand-light-gray/80 rounded-lg shadow-sm text-brand-dark hover:text-brand-primary transition-all flex items-center justify-center cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <CheckCircle2 className="w-5 h-5 text-brand-primary" />
          <span className="font-extrabold text-lg text-brand-dark">Your Active Listings</span>
          <span className="bg-brand-light-gray/40 text-brand-gray text-xs px-2.5 py-0.5 rounded-full font-black ml-auto">
            {liveGigs.length}
          </span>
        </div>

        {liveGigs.length > 0 ? (
            <div className="flex flex-col gap-4">
              {liveGigs.map((gig) => (
                <div key={gig.id} className="flex flex-col p-4 bg-brand-bg rounded-2xl border border-brand-light-gray/50 gap-3">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                      <span className="font-extrabold text-brand-dark text-base">{gig.title}</span>
                      <span className="text-xs text-brand-gray mt-1 font-semibold flex items-center gap-1.5">
                        <span>₹{gig.price}</span>
                        <span>•</span>
                        <span>{formatToDDMMYY(gig.date)}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {onUpdateGig && (
                        <button
                          onClick={() => {
                            if (editingGigId === gig.id) {
                              setEditingGigId(null);
                            } else {
                              setEditingGigId(gig.id);
                              setEditDate((gig.date || "").replace('Date: ', ''));
                              setEditTime((gig.startTime || "").replace('Starts: ', ''));
                              setEditPrice(gig.price.toString());
                            }
                          }}
                          className="p-1.5 rounded-xl text-xs font-bold transition-colors bg-brand-light-gray/20 text-brand-gray hover:bg-brand-light-gray/40 border border-brand-outline"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <span
                        className={`px-3 py-1 text-[10px] uppercase font-black rounded-lg tracking-wide border ${
                          (gig.status || 'Open') === 'Open' && !gig.isClosed
                             ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                             : gig.status === 'In Progress'
                             ? 'bg-blue-100 text-blue-800 border-blue-200'
                             : gig.status === 'Completed'
                             ? 'bg-purple-100 text-purple-800 border-purple-200'
                             : 'bg-red-100 text-red-800 border-red-200'
                        }`}
                      >
                        {gig.status || (gig.isClosed ? 'Cancelled' : 'Open')}
                      </span>
                    </div>
                  </div>

                  {/* Info Pills */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] bg-white p-2.5 rounded-xl border border-brand-light-gray/30 font-semibold text-brand-gray">
                    <div>⏰ {gig.startTime}</div>
                    <div>📍 {gig.suburb}</div>
                    {gig.acceptedByName && (
                      <div className="col-span-2 text-brand-primary">
                        👤 Assigned to: <span className="font-extrabold">{gig.acceptedByName}</span>
                      </div>
                    )}
                  </div>

                  {/* Edit Controls */}
                  {editingGigId === gig.id && (
                    <div className="mt-2 p-4 bg-white border border-brand-outline rounded-2xl flex flex-col gap-3 shadow-sm">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-bold text-brand-gray px-1">Date</label>
                          <input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            onClick={(e) => {
                              try {
                                if (typeof e.currentTarget.showPicker === 'function') {
                                  e.currentTarget.showPicker();
                                }
                              } catch (err) {}
                            }}
                            className="w-full h-10 bg-brand-bg border border-brand-outline rounded-xl px-2 text-xs md:text-sm focus:outline-none focus:border-brand-primary font-semibold text-brand-dark cursor-pointer"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="text-xs font-bold text-brand-gray px-1">Time</label>
                          <input
                            type="time"
                            value={editTime}
                            onChange={(e) => setEditTime(e.target.value)}
                            onClick={(e) => {
                              try {
                                if (typeof e.currentTarget.showPicker === 'function') {
                                  e.currentTarget.showPicker();
                                }
                              } catch (err) {}
                            }}
                            className="w-full h-10 bg-brand-bg border border-brand-outline rounded-xl px-2 text-xs md:text-sm focus:outline-none focus:border-brand-primary font-semibold text-brand-dark cursor-pointer"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-brand-gray px-1">Price (₹)</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9,]*"
                          value={editPrice}
                          onChange={(e) => {
                            const rawVal = e.target.value;
                            const cleanVal = rawVal.replace(/[^0-9]/g, "");
                            if (cleanVal === "") {
                              setEditPrice("");
                              return;
                            }
                            const numVal = parseInt(cleanVal, 10);
                            if (numVal < 0 || numVal > 10000000) return;
                            setEditPrice(numVal.toLocaleString("en-IN"));
                          }}
                          className="w-full h-10 bg-brand-bg border border-brand-outline rounded-xl px-3 text-sm focus:outline-none focus:border-brand-primary font-semibold text-brand-dark"
                        />
                      </div>
                      <button
                        onClick={() => {
                          if (onUpdateGig) {
                            onUpdateGig(gig.id, { 
                               date: editDate, 
                               startTime: editTime.replace('Starts: ', ''), 
                               price: parseInt(editPrice.replace(/[^0-9]/g, ""), 10) || gig.price,
                               isClosed: false
                            });
                          }
                          setEditingGigId(null);
                        }}
                        className="w-full h-10 bg-brand-primary text-white font-bold text-sm rounded-xl mt-1 hover:bg-brand-primary-hover transition-colors"
                      >
                        Save Changes
                      </button>
                    </div>
                  )}

                  {gig.isAccepted && (
                    <div className="mt-1 p-2 bg-green-50 border border-green-100 rounded-xl flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-green-800 uppercase tracking-wider">Accepted By</span>
                        <span className="text-xs font-semibold text-green-900 mt-0.5">
                          {gig.acceptedByName || 'Unknown'} • {gig.acceptedByPhone || 'No Phone'}
                        </span>
                      </div>
                      {gig.acceptedByPhone && (() => {
                        const cleanPhone = gig.acceptedByPhone!.replace(/[^0-9]/g, "");
                        return (
                          <a
                            href={`tel:${cleanPhone}`}
                            className="px-2.5 py-1 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-lg text-[10px] font-bold transition-all shadow-sm active:scale-95 text-center inline-block"
                          >
                            Call Neighbor
                          </a>
                        );
                      })()}
                    </div>
                  )}

                  {/* Close/Cancel Gig Option */}
                  {gig.status !== 'Cancelled' && !gig.isClosed && gig.status !== 'Completed' && (
                    <div className="mt-2 pt-2 border-t border-brand-light-gray/30">
                      {(gig.status === 'In Progress' || gig.isAccepted) ? (
                        <div className="space-y-1">
                          <button
                            disabled
                            className="w-full py-1.5 bg-slate-100 border border-slate-200 text-slate-400 font-extrabold text-[11px] rounded-xl flex items-center justify-center gap-1.5 cursor-not-allowed"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                            <span>Close / Cancel Listing</span>
                          </button>
                          <p className="text-[9px] text-red-500 font-bold text-center">
                            🚫 Mutually accepted and in progress. Cancellation is disabled to prevent misuse.
                          </p>
                        </div>
                      ) : (
                        <div>
                          {cancellingGigId !== gig.id ? (
                            <button
                              onClick={() => setCancellingGigId(gig.id)}
                              className="w-full py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-extrabold text-[11px] rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                              <span>Close / Cancel Listing</span>
                            </button>
                          ) : (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-150">
                              <p className="text-[10px] text-red-800 font-bold text-center">
                                Are you sure you want to close this listing? This action cannot be undone.
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  onClick={() => setCancellingGigId(null)}
                                  className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-[9px] font-bold py-1.5 rounded-lg transition-all cursor-pointer"
                                >
                                  No, Keep Listing
                                </button>
                                <button
                                  onClick={async () => {
                                    if (onCancelGig) {
                                      await onCancelGig(gig.id);
                                    } else if (onToggleGigStatus) {
                                      onToggleGigStatus(gig.id, true);
                                    }
                                    setCancellingGigId(null);
                                  }}
                                  className="bg-red-600 hover:bg-red-700 text-white text-[9px] font-extrabold py-1.5 rounded-lg transition-all shadow-sm cursor-pointer"
                                >
                                  Yes, Close Listing
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4 bg-brand-bg rounded-2xl border border-brand-outline border-dashed gap-3">
              <div className="w-16 h-16 bg-brand-light-gray/40 rounded-full flex items-center justify-center">
                <span className="text-2xl">🌱</span>
              </div>
              <p className="font-extrabold text-brand-dark text-center">No Live Gigs</p>
              <p className="text-xs text-brand-gray text-center max-w-[200px] leading-relaxed">
                You don't have any active live gigs currently.
              </p>
            </div>
          )}
      </div>
    );
  }

  if (activeProfileTab === 'gigs-done') {
    const completedGigsDone = allGigs.filter(gig => 
      currentUser && 
      (gig.selectedWorker?.email === currentUser.email || gig.acceptedByEmail === currentUser.email) &&
      (gig.status === 'Completed' || gig.status === 'Cancelled' || gig.isClosed)
    );

    return (
      <div className="w-full max-w-2xl mx-auto my-3 flex flex-col animate-in fade-in duration-200 bg-white rounded-3xl border border-brand-light-gray/80 shadow-md p-6" id="profile_panel">
        <div className="flex items-center gap-2 mb-6 pb-2 border-b border-brand-light-gray/30">
          <button 
            onClick={() => setActiveProfileTab('main')}
            className="p-1.5 mr-1 hover:bg-brand-light-gray/20 border border-brand-light-gray/80 rounded-lg shadow-sm text-brand-dark hover:text-brand-primary transition-all flex items-center justify-center cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <Briefcase className="w-5 h-5 text-brand-primary animate-pulse" />
          <span className="font-extrabold text-lg text-brand-dark">Gigs Done By You</span>
          <span className="bg-brand-light-gray/40 text-brand-gray text-xs px-2.5 py-0.5 rounded-full font-black ml-auto">
            {completedGigsDone.length}
          </span>
        </div>

        {completedGigsDone.length > 0 ? (
          <div className="flex flex-col gap-4">
            {completedGigsDone.map((gig) => (
              <div 
                key={gig.id} 
                onClick={() => onSelectGig && onSelectGig(gig)}
                className="flex flex-col p-4 bg-brand-bg rounded-2xl border border-brand-light-gray/50 gap-3 hover:border-brand-primary cursor-pointer transition-all hover:shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="font-extrabold text-brand-dark text-base">{gig.title}</span>
                    <span className="text-xs text-brand-gray mt-1 font-semibold flex items-center gap-1.5">
                      <span className="text-brand-primary font-bold">₹{gig.price}</span>
                      <span>•</span>
                      <span>{formatToDDMMYY(gig.date)}</span>
                    </span>
                  </div>
                  <span
                    className={`px-3 py-1 text-[10px] uppercase font-black rounded-lg tracking-wide border flex items-center gap-1 ${
                      gig.status === 'Completed'
                        ? 'bg-purple-100 text-purple-800 border-purple-200'
                        : gig.status === 'Cancelled'
                        ? 'bg-red-100 text-red-800 border-red-200'
                        : 'bg-gray-100 text-gray-800 border-gray-200'
                    }`}
                  >
                    {gig.status === 'Completed' ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Completed 🎉
                      </>
                    ) : gig.status === 'Cancelled' ? (
                      <>
                        <span className="text-[11px] leading-none">❌</span> Cancelled
                      </>
                    ) : (
                      <>
                        <span className="text-[11px] leading-none">🔒</span> Closed
                      </>
                    )}
                  </span>
                </div>

                <div className="text-xs text-brand-dark font-medium bg-white p-3 rounded-xl border border-brand-light-gray/30 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-brand-gray flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-brand-primary/70" /> Timing:</span>
                    <span className="font-bold text-right">{gig.startTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-brand-gray flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-brand-primary/70" /> Location:</span>
                    <span className="font-bold text-right">{gig.locationName || gig.suburb}</span>
                  </div>
                  {gig.posterName && (
                    <div className="flex justify-between border-t border-brand-light-gray/20 pt-1.5 mt-1.5">
                      <span className="text-brand-gray flex items-center gap-1"><UserIcon className="w-3.5 h-3.5 text-brand-primary/70" /> Posted By:</span>
                      <span className="font-bold text-brand-primary">{gig.posterName}</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <span className="text-brand-primary text-xs font-bold hover:underline flex items-center gap-1">
                    View Details →
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4 bg-brand-bg rounded-2xl border border-brand-outline border-dashed gap-3">
            <div className="w-16 h-16 bg-brand-light-gray/40 rounded-full flex items-center justify-center">
              <span className="text-2xl">💼</span>
            </div>
            <p className="font-extrabold text-brand-dark text-sm text-center">No Gigs Done Yet</p>
            <p className="text-xs text-brand-gray text-center max-w-[200px] leading-relaxed">
              When you take up and complete, cancel, or close a gig as a helper, it will appear here!
            </p>
          </div>
        )}
      </div>
    );
  }

  if (activeProfileTab === 'gigs-posted') {
    const pastPostedGigs = userGigs.filter(
      gig => gig.isClosed || gig.status === 'Cancelled' || gig.status === 'Completed'
    );

    return (
      <div className="w-full max-w-2xl mx-auto my-3 flex flex-col animate-in fade-in duration-200 bg-white rounded-3xl border border-brand-light-gray/80 shadow-md p-6" id="profile_panel">
        <div className="flex items-center gap-2 mb-6 pb-2 border-b border-brand-light-gray/30">
          <button 
            onClick={() => setActiveProfileTab('main')}
            className="p-1.5 mr-1 hover:bg-brand-light-gray/20 border border-brand-light-gray/80 rounded-lg shadow-sm text-brand-dark hover:text-brand-primary transition-all flex items-center justify-center cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <Database className="w-5 h-5 text-brand-primary animate-pulse" />
          <span className="font-extrabold text-lg text-brand-dark">Gigs Posted By You</span>
          <span className="bg-brand-light-gray/40 text-brand-gray text-xs px-2.5 py-0.5 rounded-full font-black ml-auto">
            {pastPostedGigs.length}
          </span>
        </div>

        {pastPostedGigs.length > 0 ? (
          <div className="flex flex-col gap-4">
            {pastPostedGigs.map((gig) => (
              <div 
                key={gig.id} 
                onClick={() => onSelectGig && onSelectGig(gig)}
                className="flex flex-col p-4 bg-brand-bg rounded-2xl border border-brand-light-gray/50 gap-3 hover:border-brand-primary cursor-pointer transition-all hover:shadow-sm"
              >
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="font-extrabold text-brand-dark text-base">{gig.title}</span>
                    <span className="text-xs text-brand-gray mt-1 font-semibold flex items-center gap-1.5">
                      <span className="text-brand-primary font-bold">₹{gig.price}</span>
                      <span>•</span>
                      <span>{formatToDDMMYY(gig.date)}</span>
                    </span>
                  </div>
                  <span
                    className={`px-3 py-1 text-[10px] uppercase font-black rounded-lg tracking-wide border ${
                      (gig.status || 'Open') === 'Open' && !gig.isClosed
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : gig.status === 'In Progress'
                        ? 'bg-blue-100 text-blue-800 border-blue-200'
                        : gig.status === 'Completed'
                        ? 'bg-purple-100 text-purple-800 border-purple-200'
                        : 'bg-red-100 text-red-800 border-red-200'
                    }`}
                  >
                    {gig.status || (gig.isClosed ? 'Cancelled' : 'Open')}
                  </span>
                </div>

                <div className="text-xs text-brand-dark font-medium bg-white p-3 rounded-xl border border-brand-light-gray/30 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-brand-gray flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-brand-primary/70" /> Timing:</span>
                    <span className="font-bold text-right">{gig.startTime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-brand-gray flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-brand-primary/70" /> Location:</span>
                    <span className="font-bold text-right">{gig.locationName || gig.suburb}</span>
                  </div>
                  {gig.acceptedByName && (
                    <div className="flex justify-between border-t border-brand-light-gray/20 pt-1.5 mt-1.5">
                      <span className="text-brand-gray flex items-center gap-1"><UserIcon className="w-3.5 h-3.5 text-brand-primary/70" /> Assigned Helper:</span>
                      <span className="font-bold text-brand-primary">{gig.acceptedByName}</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <span className="text-brand-primary text-xs font-bold hover:underline flex items-center gap-1">
                    View Details →
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 px-4 bg-brand-bg rounded-2xl border border-brand-outline border-dashed gap-3">
            <div className="w-16 h-16 bg-brand-light-gray/40 rounded-full flex items-center justify-center">
              <span className="text-2xl">📝</span>
            </div>
            <p className="font-extrabold text-brand-dark text-sm text-center">No Past Gigs Posted Yet</p>
            <p className="text-xs text-brand-gray text-center max-w-[200px] leading-relaxed">
              Your completed, cancelled, or closed posted gigs will appear here.
            </p>
          </div>
        )}
      </div>
    );
  }

  if (activeProfileTab === 'gig-history') {
    return (
      <div className="w-full max-w-2xl mx-auto my-3 flex flex-col animate-in fade-in duration-200 bg-white rounded-3xl border border-brand-light-gray/80 shadow-md p-6" id="profile_panel">
        <div className="flex items-center gap-2 mb-6 pb-2 border-b border-brand-light-gray/30">
          <button 
            onClick={() => setActiveProfileTab('main')}
            className="p-1.5 mr-1 hover:bg-brand-light-gray/20 border border-brand-light-gray/80 rounded-lg shadow-sm text-brand-dark hover:text-brand-primary transition-all flex items-center justify-center cursor-pointer"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <History className="w-5 h-5 text-brand-primary animate-pulse" />
          <span className="font-extrabold text-lg text-brand-dark">Your Past Gigs</span>
          <span className="bg-brand-light-gray/40 text-brand-gray text-xs px-2.5 py-0.5 rounded-full font-black ml-auto">
            {historyGigs.length}
          </span>
        </div>

        {historyGigs.length > 0 ? (
            <div className="flex flex-col gap-4">
              {historyGigs.map((gig) => (
                <div key={gig.id} className="flex flex-col p-4 bg-brand-bg rounded-2xl border border-brand-light-gray/50 gap-3">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                      <span className="font-extrabold text-brand-dark text-base line-through decoration-brand-gray/30">{gig.title}</span>
                      <span className="text-xs text-brand-gray mt-1 font-semibold flex items-center gap-1.5">
                        <span>₹{gig.price}</span>
                        <span>•</span>
                        <span>{formatToDDMMYY(gig.date)}</span>
                      </span>
                    </div>
                    <span
                      className={`px-3 py-1 text-[10px] uppercase font-black rounded-lg tracking-wide border ${
                        gig.status === 'Completed'
                          ? 'bg-purple-100 text-purple-800 border-purple-200'
                          : 'bg-red-100 text-red-800 border-red-200'
                      }`}
                    >
                      {gig.status || 'Closed'}
                    </span>
                  </div>

                  <div className="text-xs text-brand-dark font-medium bg-white p-3 rounded-xl border border-brand-light-gray/30 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-brand-gray">Timing:</span>
                      <span className="font-bold">{gig.startTime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-brand-gray">Location:</span>
                      <span className="font-bold">{gig.locationName || gig.suburb}</span>
                    </div>
                    {gig.description && (
                      <div className="border-t border-brand-light-gray/30 pt-1.5 mt-1.5 text-brand-gray leading-relaxed font-normal text-[11px]">
                        {gig.description}
                      </div>
                    )}
                    {gig.acceptedByName && (
                      <div className="border-t border-brand-light-gray/30 pt-1.5 mt-1.5 flex justify-between text-[11px]">
                        <span className="text-brand-gray">Completed with worker:</span>
                        <span className="font-extrabold text-brand-primary">{gig.acceptedByName}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4 bg-brand-bg rounded-2xl border border-brand-outline border-dashed gap-2">
              <p className="font-extrabold text-brand-dark text-sm text-center">No Ended Gigs</p>
              <p className="text-xs text-brand-gray text-center max-w-[200px] leading-relaxed">
                Your closed, cancelled, or completed gigs will appear here for reference.
              </p>
            </div>
          )}
      </div>
    );
  }

  if (activeProfileTab === 'personal-info') {
    return (
      <div className="w-full max-w-2xl mx-auto my-3 flex flex-col gap-3 animate-in fade-in duration-200" id="profile_panel">
        <div className="bg-white rounded-3xl border border-brand-light-gray/80 shadow-md p-6">
          <div className="flex items-center gap-2 mb-6 pb-2 border-b border-brand-light-gray/30">
            <h3 className="font-bold text-brand-dark flex items-center gap-2">
              <span>Personal Information</span>
            </h3>
          </div>
          <form onSubmit={handleSave} className="flex flex-col gap-4 text-left">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-brand-gray px-0.5">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-11 bg-brand-light-gray/20 border border-brand-outline focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/50 rounded-xl px-4 text-xs font-semibold focus:outline-none transition-all text-brand-dark"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-brand-gray px-0.5">Mobile Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-11 bg-brand-light-gray/20 border border-brand-outline focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/50 rounded-xl px-4 text-xs font-semibold focus:outline-none transition-all text-brand-dark"
                />
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-xs font-bold text-brand-gray px-0.5">Email Address</label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="h-11 bg-brand-light-gray/20 border border-brand-outline cursor-not-allowed rounded-xl px-4 text-xs font-semibold text-brand-gray focus:outline-none"
                />
                <span className="text-[10px] text-brand-gray/80 italic px-0.5 mt-0.5">Primary email address associated with your authentication cannot be altered.</span>
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-xs font-bold text-brand-gray px-0.5">About Me / Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us a bit about yourself, your skills, or what you're looking for..."
                  maxLength={250}
                  rows={3}
                  className="bg-brand-light-gray/20 border border-brand-outline focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/50 rounded-xl px-4 py-3 text-xs font-semibold focus:outline-none transition-all text-brand-dark resize-none"
                />
                <div className="flex justify-between px-0.5 text-[10px] text-brand-gray/80 mt-0.5 font-medium">
                  <span>Introduce yourself to the community.</span>
                  <span>{bio.length}/250</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-2">
              <button
                type="button"
                onClick={() => setActiveProfileTab('main')}
                className="h-10 px-4 rounded-xl text-xs font-bold text-brand-gray hover:bg-brand-light-gray/50 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-10 px-5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Profile Info</span>
              </button>
            </div>
          </form>
        </div>

        {/* Saved Addresses display inside Personal Info Tab */}
        {savedAddresses.length > 0 && (
          <div className="bg-white rounded-3xl border border-brand-light-gray/80 shadow-md p-6">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-brand-light-gray/30 text-left">
              <h3 className="font-bold text-brand-dark flex items-center gap-2">
                <MapPin className="w-5 h-5 text-rose-500 animate-bounce" />
                <span>Saved Addresses</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
              {savedAddresses.map((addr) => (
                <div key={addr.type} className="flex justify-between items-start p-3 bg-brand-bg/40 rounded-2xl border border-brand-light-gray/50 hover:bg-brand-bg/80 transition-all">
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="font-extrabold text-brand-dark text-xs flex items-center gap-1">
                      {addr.type === 'Home' ? '🏠' : addr.type === 'Work' ? '💼' : '📍'} {addr.customName}
                    </span>
                    <span className="text-[11px] text-brand-gray mt-0.5 leading-tight truncate">
                      {addr.door ? addr.door + ', ' : ''}{addr.address}
                    </span>
                    <span className="text-[10px] text-brand-primary font-bold mt-0.5">{addr.suburb}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteAddress(addr.type)}
                    className="p-1.5 text-red-500 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors shrink-0 cursor-pointer"
                    title="Delete Address"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Account Security (Password Setting/Updates) */}
        <div className="bg-white rounded-3xl border border-brand-light-gray/80 shadow-md p-6">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-brand-light-gray/30">
            <h3 className="font-bold text-brand-dark flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand-primary" />
              <span>Account Security</span>
            </h3>
          </div>

          {(() => {
            const userProviders = auth.currentUser?.providerData.map(p => p.providerId) || [];
            const isGoogle = userProviders.includes('google.com');
            const isEmailPass = userProviders.includes('password');

            return (
              <div className="flex flex-col gap-4 text-left">
                <div className="p-4 bg-brand-light-gray/20 rounded-2xl flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-brand-dark">
                    <span>Connected Authentication Methods:</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {isGoogle && (
                      <span className="px-3 py-1 bg-red-50 border border-red-200 text-red-600 rounded-full text-[11px] font-bold flex items-center gap-1">
                        Google Sign-In
                      </span>
                    )}
                    {isEmailPass && (
                      <span className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-full text-[11px] font-bold flex items-center gap-1">
                        Email & Password
                      </span>
                    )}
                  </div>
                  {isGoogle && !isEmailPass && (
                    <p className="text-[11px] text-brand-gray mt-1 font-medium leading-relaxed">
                      Your account currently uses Google Sign-In only. To enable signing in with your email address and a password as well, set a password below.
                    </p>
                  )}
                </div>

                <form onSubmit={handleUpdatePassword} className="flex flex-col gap-4 mt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-brand-gray px-0.5">
                        {isEmailPass ? 'New Password' : 'Set Password'}
                      </label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="h-11 bg-brand-light-gray/20 border border-brand-outline focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/50 rounded-xl px-4 text-xs font-semibold focus:outline-none transition-all text-brand-dark"
                        required
                        minLength={6}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-brand-gray px-0.5">Confirm Password</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className="h-11 bg-brand-light-gray/20 border border-brand-outline focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/50 rounded-xl px-4 text-xs font-semibold focus:outline-none transition-all text-brand-dark"
                        required
                        minLength={6}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end mt-2">
                    <button
                      type="submit"
                      disabled={isUpdatingPassword}
                      className="h-10 px-5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed"
                    >
                      {isUpdatingPassword ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Updating...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>{isEmailPass ? 'Change Password' : 'Link Password Login'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  if (activeProfileTab === 'app-feedback') {
    const categories: ('Bug Report' | 'Feature Suggestion' | 'General Experience' | 'Praise')[] = [
      'Feature Suggestion',
      'Bug Report',
      'General Experience',
      'Praise'
    ];

    const getRatingLabel = (rating: number) => {
      switch (rating) {
        case 1: return '1 - Disliked it 😞';
        case 2: return '2 - Had some issues 🫤';
        case 3: return '3 - It is okay 🙂';
        case 4: return '4 - Liked it a lot! 😊';
        case 5: return '5 - Excellent app! 🚀';
        default: return '';
      }
    };

    return (
      <div className="w-full max-w-2xl mx-auto my-3 flex flex-col gap-6 animate-in fade-in duration-200 text-left" id="profile_panel">
        {/* Form Card */}
        <div className="bg-white rounded-3xl border border-brand-light-gray/80 shadow-md p-6">
          <div className="flex items-center gap-2.5 mb-6 pb-2.5 border-b border-brand-light-gray/30">
            <button 
              type="button"
              onClick={() => setActiveProfileTab('main')}
              className="p-1.5 hover:bg-brand-light-gray/20 border border-brand-light-gray/80 rounded-lg shadow-sm text-brand-dark hover:text-brand-primary transition-all flex items-center justify-center cursor-pointer"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <MessageSquare className="w-5 h-5 text-brand-primary" />
            <h3 className="font-extrabold text-lg text-brand-dark">Submit App Feedback</h3>
          </div>

          <div className="bg-brand-primary/5 rounded-2xl p-4 border border-brand-primary/10 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between mb-4">
            <div className="flex flex-col gap-1">
              <span className="font-bold text-xs text-brand-dark">Need immediate assistance?</span>
              <p className="text-[11px] text-brand-gray leading-normal">
                If you have an urgent inquiry or support issue, get in touch with us directly at:
              </p>
            </div>
            <a 
              href="mailto:support@qwickgig.com"
              className="font-bold text-xs text-brand-primary hover:underline flex items-center gap-1 shrink-0 bg-white shadow-sm border border-brand-primary/15 px-3 py-1.5 rounded-xl transition-all"
            >
              <Mail className="w-3 h-3" />
              <span>support@qwickgig.com</span>
            </a>
          </div>

          <form onSubmit={handleFeedbackSubmit} className="flex flex-col gap-5">
            {/* Category Select Buttons */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-brand-gray px-0.5">Feedback Topic</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFeedbackCategory(cat)}
                    className={`py-2 px-3 text-center text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      feedbackCategory === cat
                        ? 'bg-brand-primary/10 text-brand-primary border-brand-primary shadow-sm scale-[1.02]'
                        : 'bg-slate-50 text-brand-gray hover:text-brand-dark border-brand-light-gray/60 hover:bg-brand-light-gray/10'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Star Rating Section */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-brand-gray px-0.5">Rating</label>
              <div className="flex flex-col items-start gap-3 bg-slate-50/50 p-4 border border-brand-light-gray/30 rounded-2xl">
                <div className="text-xs font-extrabold text-brand-dark whitespace-nowrap">
                  {getRatingLabel(feedbackRating)}
                </div>
                <div className="flex gap-1.5">
                  {Array.from({ length: 5 }).map((_, idx) => {
                    const starVal = idx + 1;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setFeedbackRating(starVal)}
                        className="p-0.5 transition-transform hover:scale-125 focus:outline-none cursor-pointer"
                        title={getRatingLabel(starVal)}
                      >
                        <Star 
                          className={`w-11 h-11 transition-colors ${
                            starVal <= feedbackRating 
                              ? 'text-amber-400 fill-amber-400' 
                              : 'text-slate-200 hover:text-amber-200'
                          }`} 
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Comment Section */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-brand-gray px-0.5">Tell us more</label>
              <textarea
                value={feedbackComment}
                onChange={(e) => setFeedbackComment(e.target.value)}
                placeholder="What did you like? What can we improve? Report bugs, request new features, or share your thoughts here..."
                rows={4}
                maxLength={1000}
                required
                className="w-full bg-brand-light-gray/20 border border-brand-outline focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/50 rounded-2xl px-4 py-3.5 text-xs font-semibold focus:outline-none transition-all text-brand-dark resize-none"
              />
              <div className="flex justify-between px-0.5 text-[10px] text-brand-gray/80 font-semibold">
                <span>Your words help make Qwick Gig better!</span>
                <span>{feedbackComment.length}/1000</span>
              </div>
            </div>

            {/* Screenshot/Attachment Upload */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-brand-gray px-0.5">Attachment (Optional screenshot or photo)</label>
              
              {feedbackFileUrl ? (
                <div className="relative w-full max-w-[200px] aspect-video rounded-xl overflow-hidden border border-brand-light-gray/80 bg-slate-50 p-1 group shadow-sm">
                  <img 
                    src={feedbackFileUrl} 
                    alt="Feedback attachment" 
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setFeedbackFileUrl("")}
                    className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors cursor-pointer"
                    title="Remove attachment"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isFeedbackUploading}
                    onClick={() => feedbackFileInputRef.current?.click()}
                    className={`flex items-center gap-2 px-4 py-2.5 border border-brand-outline hover:border-brand-primary bg-slate-50 hover:bg-brand-light-gray/10 rounded-xl cursor-pointer transition-colors ${
                      isFeedbackUploading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    {isFeedbackUploading ? (
                      <Loader2 className="w-4 h-4 text-brand-primary animate-spin" />
                    ) : (
                      <UploadCloud className="w-4 h-4 text-brand-gray" />
                    )}
                    <span className="text-xs font-bold text-brand-dark">
                      {isFeedbackUploading ? "Uploading..." : "Attach File / Screenshot"}
                    </span>
                  </button>
                  <input
                    type="file"
                    ref={feedbackFileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleFeedbackFileChange}
                  />
                </div>
              )}
            </div>

            {/* Submit Action */}
            <div className="flex gap-3 justify-end mt-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setFeedbackComment("");
                  setFeedbackRating(5);
                  setFeedbackCategory("Feature Suggestion");
                  setFeedbackFileUrl("");
                  setActiveProfileTab('main');
                }}
                className="h-10 px-4 rounded-xl text-xs font-bold text-brand-gray hover:bg-brand-light-gray/50 cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isFeedbackSubmitting || isFeedbackUploading}
                className="h-10 px-5 bg-brand-primary hover:bg-brand-primary-hover disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
              >
                {isFeedbackSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Feedback</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Past Feedback History */}
        <div className="bg-white rounded-3xl border border-brand-light-gray/80 shadow-md p-6">
          <div className="flex items-center gap-2 mb-5 pb-2 border-b border-brand-light-gray/30">
            <h4 className="font-extrabold text-base text-brand-dark">Your Feedback History</h4>
            <span className="bg-brand-light-gray/40 text-brand-gray text-xs px-2.5 py-0.5 rounded-full font-black ml-auto">
              {pastFeedbacks.length}
            </span>
          </div>

          {isLoadingPastFeedbacks ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Loader2 className="w-6 h-6 text-brand-primary animate-spin" />
              <p className="text-xs text-brand-gray font-bold">Loading your feedbacks...</p>
            </div>
          ) : pastFeedbacks.length === 0 ? (
            <div className="text-center py-12 px-4">
              <span className="text-4xl block mb-3 opacity-60">✉️</span>
              <p className="text-xs font-bold text-brand-dark">No feedbacks submitted yet</p>
              <p className="text-[11px] text-brand-gray mt-1 max-w-xs mx-auto leading-relaxed">
                When you share comments, bug reports or ideas, they will show up here along with our direct tracking status!
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 max-h-[400px] overflow-y-auto pr-1">
              {pastFeedbacks.map((fb) => (
                <div key={fb.id} className="flex flex-col gap-2.5 text-xs bg-brand-bg/30 border border-brand-light-gray/50 p-4 rounded-2xl">
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black tracking-wide border ${
                        fb.category === 'Bug Report'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : fb.category === 'Praise'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : fb.category === 'Feature Suggestion'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}>
                        {fb.category}
                      </span>
                      <span className="text-[10px] text-brand-gray/60">
                        {formatTimestampToDDMMYY(fb.createdAt)}
                      </span>
                    </div>

                    <div className="flex text-amber-400">
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <span key={idx} className="text-xs">
                          {idx < fb.rating ? "★" : "☆"}
                        </span>
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-brand-dark leading-relaxed font-semibold">
                    "{fb.comment}"
                  </p>

                  {fb.screenshotUrl && (
                    <div className="mt-1 w-full max-w-[120px] aspect-video rounded-lg overflow-hidden border border-brand-light-gray/50 shadow-sm">
                      <a href={fb.screenshotUrl} target="_blank" rel="noopener noreferrer">
                        <img 
                          src={fb.screenshotUrl} 
                          alt="Feedback attachment preview" 
                          className="w-full h-full object-cover hover:scale-110 transition-transform duration-200"
                        />
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto my-6 flex flex-col gap-6" id="profile_panel">
      <div className="bg-white rounded-3xl border border-brand-light-gray/80 shadow-md p-6">
        <div className="flex flex-col md:flex-row gap-6 items-center">
          <div className="relative shrink-0">
            <img 
              src={getUserAvatarUrl(currentUser.avatar, currentUser.email, currentUser.fullName)} 
              alt="User avatar" 
              className="w-24 h-24 rounded-full border-4 border-brand-mint/20 object-cover bg-brand-mint/10"
              onError={(e) => {
                e.currentTarget.src = getUserAvatarUrl("", currentUser.email, currentUser.fullName);
              }}
            />
            <div 
              className="absolute bottom-0 right-0 p-1.5 bg-brand-primary text-white rounded-full border-2 border-white shadow-md cursor-pointer hover:bg-brand-primary-hover"
              onClick={() => setShowPhotoSourceOptions(true)}
            >
              <Camera className="w-3.5 h-3.5" />
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileChange} 
            />
          </div>

          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
              <h2 className="text-2xl font-extrabold text-brand-dark">{toTitleCase(currentUser.fullName)}</h2>
              {currentUser.isVerified ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-mint/20 text-[10px] font-extrabold text-brand-mint-dark border border-brand-mint-dark/10">
                  <ShieldCheck className="w-3 h-3" /> VERIFIED
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-100 text-[10px] font-extrabold text-red-600 border border-red-200">
                  <ShieldAlert className="w-3 h-3" /> UNVERIFIED
                </span>
              )}
            </div>
            <p className="text-brand-gray text-xs mt-1 font-semibold">{currentUser.email}</p>
            <p className="text-brand-gray/80 text-xs mt-0.5 font-medium">
              Phone: {currentUser.phoneNumber || <span className="italic text-brand-gray/60 text-[10px]">None (Edit to add)</span>}
            </p>

             <div className="flex flex-wrap gap-3 mt-4 justify-center md:justify-start">
              <div 
                onClick={() => setActiveProfileTab('gigs-done')}
                className="bg-brand-light-gray/20 border border-brand-light-gray/50 rounded-2xl px-4 py-2.5 text-center min-w-[90px] flex-1 sm:flex-initial cursor-pointer hover:bg-brand-primary/5 hover:border-brand-primary/40 active:scale-95 transition-all"
                title="Click to view all gigs done by you"
              >
                <span className="block text-xl font-extrabold text-brand-dark">{actualCompletedGigsDone.length}</span>
                <span className="text-[10px] text-brand-gray font-extrabold tracking-wider uppercase">Gigs Done</span>
              </div>
              <div 
                onClick={() => setActiveProfileTab('gigs-posted')}
                className="bg-brand-light-gray/20 border border-brand-light-gray/50 rounded-2xl px-4 py-2.5 text-center min-w-[90px] flex-1 sm:flex-initial cursor-pointer hover:bg-brand-primary/5 hover:border-brand-primary/40 active:scale-95 transition-all"
                title="Click to view all gigs posted by you"
              >
                <span className="block text-xl font-extrabold text-brand-dark">{historyGigs.length}</span>
                <span className="text-[10px] text-brand-gray font-extrabold tracking-wider uppercase">Gigs Posted</span>
              </div>
              <div 
                onClick={() => setActiveProfileTab('reviews')}
                className="bg-brand-light-gray/20 border border-brand-light-gray/50 rounded-2xl px-4 py-2.5 text-center min-w-[90px] flex-1 sm:flex-initial cursor-pointer hover:bg-brand-primary/5 hover:border-brand-primary/40 active:scale-95 transition-all"
                title="Click to view all reviews and ratings"
              >
                <span className="block text-xl font-extrabold text-[#e2c62d] flex items-center justify-center gap-1">
                  ★ <span className="text-brand-dark">{(currentUser as any).rating !== undefined ? (currentUser as any).rating.toFixed(1) : "4.8"}</span>
                </span>
                <span className="text-[10px] text-brand-gray font-extrabold tracking-wider uppercase">Rating ({(currentUser as any).ratingCount ?? 5})</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-brand-light-gray/80 shadow-md p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-extrabold text-brand-dark flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-brand-primary" />
            <span>Identity Verification</span>
          </h3>
          {currentUser.isVerified ? (
            <span className="px-2.5 py-1 text-[10px] font-extrabold bg-brand-mint/15 text-brand-mint-dark border border-brand-mint-dark/20 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> VERIFIED
            </span>
          ) : currentUser.aadharUrl && currentUser.verificationStatus !== "rejected" ? (
            <span className="px-2.5 py-1 text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> PENDING
            </span>
          ) : currentUser.verificationStatus === "rejected" ? (
            <span className="px-2.5 py-1 text-[10px] font-extrabold bg-red-50 text-red-600 border border-red-200 rounded-full flex items-center gap-1">
              <XCircle className="w-3.5 h-3.5" /> REJECTED
            </span>
          ) : (
            <span className="px-2.5 py-1 text-[10px] font-extrabold bg-slate-100 text-slate-500 border border-slate-200 rounded-full">
              NOT SUBMITTED
            </span>
          )}
        </div>

        {currentUser.aadharUrl && currentUser.verificationStatus !== "rejected" ? (
          currentUser.isVerified ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3.5 p-4 bg-brand-mint/5 border border-brand-mint/20 rounded-2xl">
                <div className="w-10 h-10 rounded-full bg-brand-mint/10 flex items-center justify-center shrink-0 border border-brand-mint/20">
                  <ShieldCheck className="w-5 h-5 text-brand-mint-dark" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-brand-dark">Aadhaar Verified Successfully</p>
                  <p className="text-xs text-brand-gray font-medium leading-relaxed mt-0.5">Your identity has been fully verified. Thank you for keeping the Qwick community safe and trusted!</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3.5 p-4 bg-amber-50/65 border border-amber-200/60 rounded-2xl">
                <div className="w-10 h-10 rounded-full bg-amber-100/80 flex items-center justify-center shrink-0 border border-amber-200">
                  <FileText className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-brand-dark">Aadhaar Under Review</p>
                  <p className="text-xs text-amber-700 font-semibold leading-relaxed mt-0.5">
                    Our team is currently verifying your Aadhaar card details. This usually takes less than 24 hours. You'll receive a notification once the process is complete.
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100">
                <p className="text-xs text-brand-gray font-semibold leading-relaxed mb-3">
                  Need to update or replace your submission with a clearer file? Upload again:
                </p>
                <motion.button
                  type="button"
                  disabled={isAadharUploading}
                  whileTap={isAadharUploading ? undefined : { scale: 0.97 }}
                  onClick={() => {
                    triggerWithPermission(() => {
                      aadharInputRef.current?.click();
                    });
                  }}
                  className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 sm:py-3 border-2 border-dashed rounded-xl cursor-pointer transition-all group w-full text-center ${
                    isAadharUploading
                      ? 'bg-brand-primary/[0.01] border-brand-primary/40 cursor-not-allowed text-brand-primary'
                      : 'bg-brand-bg hover:bg-brand-light-gray/30 border-brand-outline hover:border-brand-primary'
                  }`}
                >
                  {isAadharUploading ? (
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 text-brand-primary animate-spin" />
                  ) : (
                    <UploadCloud className="w-4 h-4 sm:w-5 sm:h-5 text-brand-gray group-hover:text-brand-primary transition-colors" />
                  )}
                  <span className={`text-xs sm:text-sm font-bold transition-colors ${isAadharUploading ? 'text-brand-primary' : 'text-brand-dark group-hover:text-brand-primary'}`}>
                    {isAadharUploading ? "Uploading document..." : "Replace Aadhaar File"}
                  </span>
                  <input 
                    type="file" 
                    ref={aadharInputRef}
                    className="hidden" 
                    accept="image/*,.pdf"
                    disabled={isAadharUploading}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0] && currentUser) {
                        const file = e.target.files[0];
                        setIsAadharUploading(true);
                        const reader = new FileReader();
                        reader.onloadend = async () => {
                          const dataUrl = reader.result as string;
                          try {
                            const uploadedUrl = await uploadFileWithFallback(dataUrl, "aadhar", currentUser.email);
                            onUpdateProfile({
                              ...currentUser,
                              aadharUrl: uploadedUrl,
                              isVerified: false,
                              verificationStatus: 'pending'
                            });
                          } catch (err) {
                            console.error("Error uploading Aadhar:", err);
                            onUpdateProfile({
                              ...currentUser,
                              aadharUrl: dataUrl,
                              isVerified: false,
                              verificationStatus: 'pending'
                            });
                          } finally {
                            setIsAadharUploading(false);
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </motion.button>
              </div>
            </div>
          )
        ) : (
          <div className="flex flex-col gap-4">
            {currentUser.verificationStatus === "rejected" && (
              <div className="flex items-start gap-3.5 p-4 bg-red-50/70 border border-red-200/60 rounded-2xl">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0 border border-red-200">
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-red-700">Verification Request Rejected ❌</p>
                  <p className="text-xs text-red-600 font-semibold leading-relaxed mt-0.5">
                    Your submitted Aadhaar document was rejected by the administrator. This is usually due to a blurry image or mismatched details. Please re-upload a clear copy of your Aadhaar card to try again.
                  </p>
                </div>
              </div>
            )}
            <p className="text-xs text-brand-gray font-semibold leading-relaxed">
              To keep Qwick safe and secure for everyone, all users must verify their identity. Uploading your Aadhaar card builds trust, lets you apply for premium gigs, and unlocks advanced poster privileges.
            </p>
            <motion.button
              type="button"
              disabled={isAadharUploading}
              whileTap={isAadharUploading ? undefined : { scale: 0.97 }}
              onClick={() => {
                triggerWithPermission(() => {
                  aadharInputRef.current?.click();
                });
              }}
              className={`flex flex-col items-center justify-center gap-2 sm:gap-3 p-4 sm:p-6 border-2 border-dashed rounded-2xl transition-all duration-200 group text-center w-full ${
                isAadharUploading 
                  ? 'border-brand-primary/50 cursor-not-allowed bg-brand-primary/[0.02]' 
                  : 'bg-slate-50 hover:bg-slate-100/65 border-slate-300 hover:border-brand-primary cursor-pointer'
              }`}
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:shadow transition-all duration-200 shrink-0">
                {isAadharUploading ? (
                  <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-brand-primary animate-spin" />
                ) : (
                  <UploadCloud className="w-5 h-5 sm:w-6 sm:h-6 text-brand-gray group-hover:text-brand-primary transition-colors" />
                )}
              </div>
              <div className="w-full px-1">
                <p className="text-xs sm:text-sm font-extrabold text-brand-dark group-hover:text-brand-primary transition-colors leading-snug break-words">
                  {isAadharUploading 
                    ? "Uploading document..." 
                    : currentUser.verificationStatus === "rejected" 
                      ? "Re-upload Aadhaar Card" 
                      : "Upload Aadhaar Card (Image or PDF)"}
                </p>
                <p className="text-[10px] sm:text-[11px] text-brand-gray font-medium mt-1 leading-normal break-words">
                  {isAadharUploading ? "Please wait while we process your file securely" : "Max size 5MB • PNG, JPG, JPEG or PDF"}
                </p>
              </div>
              <input 
                type="file" 
                ref={aadharInputRef}
                className="hidden" 
                accept="image/*,.pdf"
                disabled={isAadharUploading}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0] && currentUser) {
                    const file = e.target.files[0];
                    setIsAadharUploading(true);
                    const reader = new FileReader();
                    reader.onloadend = async () => {
                      const dataUrl = reader.result as string;
                      try {
                        const uploadedUrl = await uploadFileWithFallback(dataUrl, "aadhar", currentUser.email);
                        onUpdateProfile({
                          ...currentUser,
                          aadharUrl: uploadedUrl,
                          isVerified: false,
                          verificationStatus: 'pending'
                        });
                      } catch (err) {
                        console.error("Error uploading Aadhar:", err);
                        onUpdateProfile({
                          ...currentUser,
                          aadharUrl: dataUrl,
                          isVerified: false,
                          verificationStatus: 'pending'
                        });
                      } finally {
                        setIsAadharUploading(false);
                      }
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
            </motion.button>
          </div>
        )}
      </div>

      <div 
        onClick={() => setActiveProfileTab('personal-info')}
        className="bg-white rounded-3xl border border-brand-light-gray/80 shadow-md p-6 flex items-center justify-between cursor-pointer hover:border-brand-primary transition-all"
      >
        <div className="font-bold text-brand-dark flex items-center gap-2">
          <UserIcon className="w-5 h-5 text-brand-primary" />
          <span>Personal Information</span>
        </div>
      </div>

      {/* Collapsed Live Gigs Section on Main Profile */}
      <div 
        onClick={() => setActiveProfileTab('live-gigs')}
        className="bg-white rounded-3xl border border-brand-light-gray/80 shadow-md p-5 flex items-center justify-between cursor-pointer hover:border-brand-primary/50 hover:bg-brand-primary/[0.01] transition-all mt-2 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-100 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="font-extrabold text-brand-dark">Live Gigs</p>
            <p className="text-xs text-brand-gray font-semibold mt-0.5">Manage and track your active gig listings</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="bg-brand-light-gray/40 text-brand-gray text-xs px-3 py-1 rounded-full font-black">
            {liveGigs.length}
          </span>
          <span className="text-brand-gray text-lg font-bold">→</span>
        </div>
      </div>

      {/* Collapsed FAQ Section on Main Profile */}
      <div 
        onClick={() => setActiveProfileTab('faq')}
        className="bg-white rounded-3xl border border-brand-light-gray/80 shadow-md p-5 flex items-center justify-between cursor-pointer hover:border-brand-primary/50 hover:bg-brand-primary/[0.01] transition-all mt-2 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center border border-blue-100 shrink-0">
            <HelpCircle className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <p className="font-extrabold text-brand-dark">Help & FAQs</p>
            <p className="text-xs text-brand-gray font-semibold mt-0.5">Got questions? Find answers about gigs, payments, and safety</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-brand-gray text-lg font-bold">→</span>
        </div>
      </div>

      {/* Collapsed App Feedback Section on Main Profile */}
      <div 
        onClick={() => setActiveProfileTab('app-feedback')}
        className="bg-white rounded-3xl border border-brand-light-gray/80 shadow-md p-5 flex items-center justify-between cursor-pointer hover:border-brand-primary/50 hover:bg-brand-primary/[0.01] transition-all mt-2 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-primary/10 text-brand-primary rounded-full flex items-center justify-center border border-brand-primary/25 shrink-0">
            <MessageSquare className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <p className="font-extrabold text-brand-dark">Submit App Feedback</p>
            <p className="text-xs text-brand-gray font-semibold mt-0.5">Share bugs, praise, feature ideas, or suggest improvements</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-brand-gray text-lg font-bold">→</span>
        </div>
      </div>




      <div className="flex justify-between items-center bg-red-50/50 border border-red-100 rounded-3xl p-6 mt-2 text-left mb-6">
        <div>
          <h4 className="font-extrabold text-sm text-brand-dark">Sign Out of Account</h4>
          <p className="text-xs text-brand-gray leading-normal mt-0.5">Disconnect your secure workspace sync from this local device browser caching.</p>
        </div>
        <button
          onClick={() => {
            setConfirmDialog({
              isOpen: true,
              title: 'Sign Out?',
              message: 'Are you sure you want to sign out of your account?',
              actionLabel: 'Sign Out',
              actionColor: 'bg-red-600 hover:bg-red-700',
              onConfirm: () => {
                onLogOut();
                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
              }
            });
          }}
          className="px-4 py-2.5 bg-white hover:bg-red-500 hover:text-white text-red-600 border border-red-200 hover:border-transparent font-extrabold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>

      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-[24px] p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 relative overflow-hidden text-left">
            <h3 className="font-extrabold text-brand-dark text-xl">{confirmDialog.title}</h3>
            <p className="text-sm font-semibold text-brand-gray">{confirmDialog.message}</p>
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-3 bg-brand-light-gray/30 hover:bg-brand-light-gray/50 text-brand-dark font-extrabold text-xs rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className={`flex-1 py-3 text-white font-extrabold text-xs rounded-xl transition-colors ${confirmDialog.actionColor}`}
              >
                {confirmDialog.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={async (imageSrc) => {
          if (currentUser) {
            try {
              const uploadedUrl = await uploadFileWithFallback(imageSrc, "avatar", currentUser.email);
              onUpdateProfile({
                ...currentUser,
                avatar: uploadedUrl
              });
            } catch (err) {
              console.error("Error uploading camera photo:", err);
              onUpdateProfile({ ...currentUser, avatar: imageSrc });
            }
          }
        }}
      />

      {showPhotoSourceOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-[24px] overflow-hidden shadow-2xl max-w-sm w-full relative flex flex-col p-6 text-center border border-brand-light-gray">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <h3 className="text-brand-dark font-black text-base">Profile Photo</h3>
              <button 
                onClick={() => setShowPhotoSourceOptions(false)} 
                className="text-brand-gray hover:text-brand-dark p-1 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-brand-gray mb-6 font-medium">How would you like to update your profile picture?</p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setShowPhotoSourceOptions(false);
                  triggerWithPermission(() => {
                    setIsCameraOpen(true);
                  });
                }}
                className="flex items-center gap-3 p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl transition-all cursor-pointer text-left active:scale-[0.98]"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-black text-brand-dark">Take Photo</p>
                  <p className="text-[10px] text-brand-gray font-medium">Use your camera to capture a new picture</p>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowPhotoSourceOptions(false);
                  triggerWithPermission(() => {
                    fileInputRef.current?.click();
                  });
                }}
                className="flex items-center gap-3 p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl transition-all cursor-pointer text-left active:scale-[0.98]"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-mint/20 text-brand-mint-dark flex items-center justify-center">
                  <Image className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-black text-brand-dark">Upload from Gallery</p>
                  <p className="text-[10px] text-brand-gray font-medium">Choose an existing image from your device</p>
                </div>
              </button>

              {(() => {
                const hasUploadedPhoto = currentUser?.avatar && 
                  (currentUser.avatar.startsWith("data:image/jpeg") || 
                   currentUser.avatar.startsWith("data:image/png") || 
                   currentUser.avatar.startsWith("data:image/webp") || 
                   currentUser.avatar.includes("firebasestorage") || 
                   currentUser.avatar.includes("/api/upload") || 
                   (!currentUser.avatar.startsWith("data:image/svg+xml") && !currentUser.avatar.includes("dicebear.com")));
                
                return currentUser?.avatar && hasUploadedPhoto ? (
                  <button
                    onClick={() => {
                      setShowPhotoSourceOptions(false);
                      onUpdateProfile({
                        ...currentUser,
                        avatar: ""
                      });
                    }}
                    className="flex items-center gap-3 p-4 bg-red-50 hover:bg-red-100 border border-red-200 rounded-2xl transition-all cursor-pointer text-left active:scale-[0.98]"
                  >
                    <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-red-700">Remove Photo</p>
                      <p className="text-[10px] text-red-500 font-medium">Revert to the default auto-generated avatar</p>
                    </div>
                  </button>
                ) : null;
              })()}
            </div>
          </div>
        </div>
      )}

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
                onClick={() => {
                  localStorage.setItem("qwick_location_permission_asked", "yes");
                  setShowLocationPrompt(false);
                  if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                      (position) => {
                        console.log("Location enabled successfully:", position);
                        if (pendingUserToLogin) {
                          onLogIn(pendingUserToLogin, true, pendingPassword);
                          setPendingUserToLogin(null);
                          setPendingPassword('');
                        }
                      },
                      (error) => {
                        console.warn("Location permission denied/failed:", error);
                        if (pendingUserToLogin) {
                          onLogIn(pendingUserToLogin, true, pendingPassword);
                          setPendingUserToLogin(null);
                          setPendingPassword('');
                        }
                      },
                      { enableHighAccuracy: true, timeout: 5000 }
                    );
                  } else {
                    if (pendingUserToLogin) {
                      onLogIn(pendingUserToLogin, true, pendingPassword);
                      setPendingUserToLogin(null);
                      setPendingPassword('');
                    }
                  }
                }}
                className="w-full py-3 bg-brand-primary text-white font-extrabold text-xs rounded-xl shadow-md shadow-brand-primary/20 hover:bg-brand-primary-hover active:scale-[0.98] transition-all cursor-pointer"
              >
                Enable Location Access
              </button>
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem("qwick_location_permission_asked", "yes");
                  setShowLocationPrompt(false);
                  if (pendingUserToLogin) {
                    onLogIn(pendingUserToLogin, true, pendingPassword);
                    setPendingUserToLogin(null);
                    setPendingPassword('');
                  }
                }}
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
