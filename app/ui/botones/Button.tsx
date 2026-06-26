'use client';
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'purple' | 'blue' | 'red' | 'yellow' | 'violet' | 'disabled';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
}

export const Button = ({ children, variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) => {
  const baseStyles = "inline-flex items-center justify-center font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm";
  
  const variants = {
    primary: "bg-black text-white hover:bg-gray-800",
    purple: "bg-purple-50 text-purple-600 hover:bg-purple-600 hover:text-white",
    blue: "bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white",
    red: "bg-red-50 text-red-600 hover:bg-red-600 hover:text-white",
    yellow: "bg-yellow-50 text-yellow-600 border border-yellow-200 hover:bg-yellow-100 cursor-pointer",
    violet: "bg-violet-600 text-white hover:bg-violet-700 shadow-md",
    disabled: "bg-gray-100 text-gray-400 shadow-none"
  };

  const sizes = {
    sm: "text-[9px] px-3 py-2 rounded-lg",
    md: "text-[10px] px-4 py-2 rounded-lg",
    lg: "text-[10px] px-6 py-3 rounded-xl",
    xl: "text-xs tracking-[0.2em] py-5 rounded-2xl"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`} 
      {...props}
    >
      {children}
    </button>
  );
};