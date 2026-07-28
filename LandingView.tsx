/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { Zap, CheckCircle2, ShieldCheck, HelpCircle, ArrowRight, Plus, Handshake, Users, Award, Star } from 'lucide-react';
import { ActiveView, User } from '../types';
import FaqAccordion from './FaqAccordion';
import communityHelperImg from '../assets/images/regenerated_image_1783150100935.jpg';

interface LandingViewProps {
  onNavigate: (view: ActiveView) => void;
  user?: User | null;
}

export default function LandingView({ onNavigate, user }: LandingViewProps) {
  return (
    <div className="w-full min-h-screen bg-brand-bg relative overflow-x-hidden pt-2 pb-24">
      {/* Background Glows */}
      <div className="absolute top-[10%] right-[-10%] w-72 h-72 bg-brand-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[20%] left-[-10%] w-72 h-72 bg-brand-mint/20 rounded-full blur-[90px] pointer-events-none" />

      {/* Main Content Area */}
      <div className="max-w-md mx-auto px-4 flex flex-col gap-10">
        
        {/* Animated Hero Header */}
        <motion.section 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="flex flex-col items-center text-center pt-2"
        >
          {/* Trust Badge */}
          <div className="inline-flex items-center gap-1.5 bg-brand-mint/40 text-brand-mint-dark text-xs font-bold px-3 py-1.5 rounded-full mb-5 border border-brand-mint-dark/10 shadow-sm">
            <ShieldCheck className="w-4 h-4 text-brand-mint-dark" />
            <span className="tracking-wider">Trusted by 1,000+ Neighbors</span>
          </div>

          {/* Heading */}
          <h1 className="text-3xl font-extrabold text-brand-dark tracking-tight leading-tight mb-4">
            Local Help, <span className="text-brand-primary">Made Qwick & Simple.</span>
          </h1>

          {/* Subheading */}
          <p className="text-sm text-brand-gray/90 leading-relaxed mb-6 max-w-sm">
            Connect with trusted people nearby for everyday tasks. Post a task or earn by helping. It's that easy.
          </p>

          {/* Core CTAs */}
          <div className="w-full flex flex-row gap-3">
            <button
              onClick={() => onNavigate(ActiveView.FEED)}
              className="flex-1 py-3 sm:py-4 bg-brand-primary text-white rounded-xl font-bold text-xs sm:text-sm shadow-lg shadow-brand-primary/20 hover:bg-brand-primary-hover active:scale-95 transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer"
            >
              <span>Do a Gig</span>
              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button
              onClick={() => onNavigate(ActiveView.POST)}
              className="flex-1 py-3 sm:py-4 bg-white border border-brand-primary text-brand-primary rounded-xl font-bold text-xs sm:text-sm hover:bg-brand-light-gray/20 active:scale-95 transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer"
            >
              <span>Post a Gig</span>
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>

          {/* Zero Fees trust message banner */}
          <div className="w-full mt-4 p-3 bg-brand-primary/10 text-brand-primary font-extrabold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 border border-brand-primary/20 shadow-sm tracking-wider">
            <span>Completely Free • No Charges • You Pay Directly</span>
          </div>
        </motion.section>

        {/* Ambient Community Imagery */}
        <motion.section 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative rounded-2xl border border-brand-light-gray shadow-md"
        >
          <img 
            src={communityHelperImg} 
            alt="Local community helper" 
            className="w-full h-64 object-cover rounded-2xl"
            referrerPolicy="no-referrer"
          />
          {/* Floater metrics */}
          <div className="absolute -bottom-6 -right-2 bg-white p-2 px-3 rounded-lg border border-brand-light-gray shadow-md flex items-center gap-2 z-10">
            <div className="w-6 h-6 rounded bg-brand-primary/10 flex items-center justify-center">
              <Zap className="w-3 h-3 text-brand-primary fill-brand-primary" />
            </div>
            <div>
              <p className="text-[8px] text-brand-gray uppercase font-extrabold tracking-wider leading-none mb-0.5">Avg. Earned Today</p>
              <p className="font-extrabold text-brand-primary text-sm leading-none">₹1,250</p>
            </div>
          </div>
        </motion.section>

        {/* Value Prop Columns */}
        <section className="flex flex-col gap-4">
          <div className="text-center mb-2">
            <h2 className="text-xl font-bold tracking-tight text-brand-dark">Why Qwick Gig?</h2>
            <p className="text-xs text-brand-gray mt-1">Built for busy households, students, and local earners across India.</p>
          </div>

          {/* Card 1 */}
          <div className="bg-white p-5 rounded-2xl border border-brand-light-gray shadow-sm group hover:border-brand-primary/20 transition-all">
            <div className="w-10 h-10 bg-brand-primary/10 rounded-xl flex items-center justify-center mb-4 text-brand-primary group-hover:bg-brand-primary/20 transition-colors">
              <Zap className="w-5 h-5 fill-brand-primary" />
            </div>
            <h3 className="font-bold text-sm text-brand-dark mb-1">Fast & Reliable</h3>
            <p className="text-xs text-brand-gray leading-relaxed">
              Get matched with available help in under 15 minutes. Our real-time tracking ensures you're never left waiting.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-white p-5 rounded-2xl border border-brand-light-gray shadow-sm group hover:border-brand-primary/20 transition-all">
            <div className="w-10 h-10 bg-brand-mint/40 rounded-xl flex items-center justify-center mb-4 text-brand-mint-dark">
              <ShieldCheck className="w-5 h-5 text-brand-mint-dark" />
            </div>
            <h3 className="font-bold text-sm text-brand-dark mb-1">Verified Neighbors</h3>
            <p className="text-xs text-brand-gray leading-relaxed">
              Safety first. Every user is identity-verified via Aadhaar, ensuring a community of trusted local individuals.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-white p-5 rounded-2xl border border-brand-light-gray shadow-sm group hover:border-brand-primary/20 transition-all">
            <div className="w-10 h-10 bg-brand-mint/20 rounded-xl flex items-center justify-center mb-4 text-brand-accent">
              <Handshake className="w-5 h-5 text-brand-accent" />
            </div>
            <h3 className="font-bold text-sm text-brand-dark mb-1">Fair Negotiations</h3>
            <p className="text-xs text-brand-gray leading-relaxed">
              No fixed rates. Directly negotiate via our integrated real-time chat to find a price that works for both sides.
            </p>
          </div>
        </section>

        {/* "3 Simple Steps" Section */}
        <section className="bg-brand-light-gray/20 rounded-2xl p-6 border border-brand-light-gray/40">
          <h2 className="text-lg font-bold text-brand-dark mb-6 text-center">Getting things done in 3 simple steps</h2>
          
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-primary text-white text-xs font-bold flex items-center justify-center">1</div>
              <div>
                <h4 className="font-bold text-xs text-brand-dark mb-1">Post a task or find one nearby</h4>
                <p className="text-xs text-brand-gray">Describe what you need (like "Stand in queue" or "Pet Sitting") or browse active gigs in your PIN code.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-primary text-white text-xs font-bold flex items-center justify-center">2</div>
              <div>
                <h4 className="font-bold text-xs text-brand-dark mb-1">Instant In-App Chat</h4>
                <p className="text-xs text-brand-gray">Open the chat thread to instantly message your neighbor. Discuss details and agree on a fair price in real-time.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-primary text-white text-xs font-bold flex items-center justify-center">3</div>
              <div>
                <h4 className="font-bold text-xs text-brand-dark mb-1">Get it Done & Pay</h4>
                <p className="text-xs text-brand-gray">The job gets completed locally. Pay directly using your favorite UPI app or cash. No platform fees.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Real-life Mockup Visual with Float Indicator */}
        <section className="bg-brand-light-gray p-4 rounded-[2rem] relative">
          <div className="bg-white rounded-[1.50rem] p-4 text-left border border-brand-light-gray/90 shadow-lg flex flex-col gap-3 min-h-[160px] relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div className="inline-flex items-center gap-1 bg-brand-mint text-brand-mint-dark text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full">
                Urgent
              </div>
              <span className="font-bold text-xs text-brand-primary">₹500</span>
            </div>
            <h5 className="font-bold text-xs text-brand-dark flex items-center gap-1">
              Take my dog for a walk <span className="text-lg inline-block leading-none">🦮</span>
            </h5>
            <p className="text-[10px] text-brand-gray">HSR Layout, Sector 2 • Bengaluru</p>
            {user ? (
              <button 
                onClick={() => onNavigate(ActiveView.FEED)}
                className="w-full py-3 bg-brand-primary text-white rounded-xl text-[10px] font-extrabold flex items-center justify-center gap-1 cursor-pointer hover:bg-brand-primary-hover transition-all active:scale-[0.98] shadow-sm"
              >
                <span>Browse Gigs</span>
              </button>
            ) : (
              <button 
                onClick={() => onNavigate(ActiveView.PROFILE)}
                className="w-full py-3 bg-brand-primary text-white rounded-xl text-[10px] font-extrabold flex items-center justify-center gap-1 cursor-pointer hover:bg-brand-primary-hover transition-all active:scale-[0.98] shadow-sm"
              >
                <span>Login Now</span>
              </button>
            )}
          </div>

          {/* Real-time proximity bubble */}
          <div className="absolute -bottom-3 -right-2 bg-white p-3 pr-4 rounded-full border border-brand-light-gray shadow-md flex items-center gap-2 animate-bounce">
            <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-ping" />
            <span className="text-[10px] font-extrabold text-brand-dark">Live: 42 Gigs near you</span>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="flex flex-col gap-4">
          <div className="text-center mb-1">
            <h2 className="text-xl font-bold tracking-tight text-brand-dark flex items-center justify-center gap-2">
              <span>Frequently Asked Questions</span>
            </h2>
            <p className="text-xs text-brand-gray mt-1">Everything you need to know about using Qwick Gig.</p>
          </div>
          <FaqAccordion />
        </section>

        {/* Ready to start action banner */}
        <section className="text-center py-6 flex flex-col gap-4">
          <h3 className="text-xl font-extrabold text-brand-dark tracking-tight">Ready to get started?</h3>
          <p className="text-xs text-brand-gray leading-normal mb-2">Join your local neighborhood marketplace today. Whether it's a small task or a custom job, Qwick Gig is here to help.</p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => onNavigate(ActiveView.FEED)}
              className="w-full py-4 bg-brand-primary text-white font-extrabold text-sm rounded-xl shadow-md shadow-brand-primary/20 hover:scale-[1.01] transition-transform cursor-pointer"
            >
              Start Earning Today
            </button>
            <button
              onClick={() => onNavigate(ActiveView.POST)}
              className="w-full py-4 bg-white border border-brand-gray text-brand-dark font-bold text-sm rounded-xl hover:bg-brand-light-gray/20 transition-colors"
            >
              Post Your First Gig
            </button>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-brand-light-gray/80 pt-6 text-center text-[10px] text-brand-gray/60 flex flex-col gap-2">
          <p className="font-extrabold text-brand-primary">Qwick Gig India</p>
          <p>© 2026 Qwick Gig India. Empowering local talent.</p>
        </footer>
      </div>
    </div>
  );
}
