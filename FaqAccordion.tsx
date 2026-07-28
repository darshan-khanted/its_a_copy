import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HelpCircle, ChevronDown } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
}

const FAQS: FaqItem[] = [
  {
    question: "What is this app?",
    answer: "A hyperlocal platform where you can post short-term gigs, like walking a dog, helping move furniture, or volunteering at an event and people nearby can take them up and earn money. Anyone can post a gig, and anyone can do one."
  },
  {
    question: "How do I post or do a gig?",
    answer: "To post a gig, tap \"Post a Gig,\" add the task details, your budget, and location, and it goes live for people nearby to see. To do a gig, browse gigs near you and tap \"I'm Interested\" on any task you'd like to take up."
  },
  {
    question: "Can I decide who does my gig?",
    answer: "Yes. When people show interest in your gig, you can chat with them directly on the app and choose whoever feels like the right fit for the job."
  },
  {
    question: "How does payment work?",
    answer: "Payment happens directly between you and the other person after the gig is completed, based on what you've agreed. We recommend confirming the amount clearly in chat before starting."
  },
  {
    question: "How do I know the person is genuine?",
    answer: "Users can verify their identity through Aadhar upload, shown as a \"Verified\" badge on their profile. You can also check their ratings and reviews from past gigs before deciding."
  }
];

export default function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      {FAQS.map((faq, index) => {
        const isOpen = openIndex === index;
        return (
          <div 
            key={index} 
            className="bg-white rounded-2xl border border-brand-light-gray/80 shadow-sm overflow-hidden transition-all duration-300"
          >
            <button
              type="button"
              onClick={() => toggleFaq(index)}
              className="w-full py-4 px-5 flex items-center justify-between text-left gap-4 hover:bg-brand-bg/40 transition-colors duration-200"
            >
              <div className="flex items-center gap-3">
                <HelpCircle className="w-4 h-4 text-brand-primary shrink-0" />
                <span className="font-extrabold text-xs text-brand-dark leading-relaxed">
                  {faq.question}
                </span>
              </div>
              <ChevronDown 
                className={`w-4 h-4 text-brand-gray transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180 text-brand-primary' : ''}`} 
              />
            </button>
            
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                >
                  <div className="px-5 pb-5 pt-1 text-[11px] leading-relaxed text-brand-gray border-t border-brand-light-gray/20 bg-brand-bg/10 font-medium">
                    {faq.answer}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
