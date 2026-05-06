'use client';

export const Button = ({ children, variant = 'primary', className = '', ...props }: any) => {
  const styles: any = {
    primary: "bg-black text-white hover:bg-gray-800",
    outline: "border-2 border-gray-200 text-black hover:bg-gray-50",
    danger: "bg-red-600 text-white"
  };

  return (
    <button 
      className={`px-6 py-3 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};