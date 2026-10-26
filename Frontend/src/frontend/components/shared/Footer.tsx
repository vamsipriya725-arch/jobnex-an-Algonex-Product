import React from "react";
import { Linkedin, Twitter, Instagram } from "lucide-react";

export const Footer: React.FC = () => {
  return (
    <footer className="bg-brand-950 text-slate-500 py-8 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <nav className="flex items-center gap-6 text-xs text-slate-500">
            <a href="#" className="hover:text-white transition-colors">
              About
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Help
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Privacy
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Terms
            </a>
          </nav>
          <div className="flex items-center gap-4 text-slate-500">
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noreferrer"
              aria-label="LinkedIn"
              className="hover:text-brand-400 transition-colors"
            >
              <Linkedin className="w-4 h-4" />
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noreferrer"
              aria-label="Twitter"
              className="hover:text-brand-400 transition-colors"
            >
              <Twitter className="w-4 h-4" />
            </a>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              className="hover:text-brand-400 transition-colors"
            >
              <Instagram className="w-4 h-4" />
            </a>
          </div>
        </div>
        <div className="pt-5 mt-6 border-t border-white/10 text-center">
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} JobNex Inc. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
