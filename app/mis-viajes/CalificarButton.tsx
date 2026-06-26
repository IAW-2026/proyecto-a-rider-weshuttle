'use client'

import { useEffect, useState } from 'react'

interface CalificarButtonProps {
  reservaId: string;
  feedbackUrl: string;
}

export default function CalificarButton({ reservaId, feedbackUrl }: CalificarButtonProps) {
  const [isRated, setIsRated] = useState(false);

  useEffect(() => {
    try {
      const rated = localStorage.getItem(`rated_${reservaId}`);
      if (rated === 'true') {
        setIsRated(true);
      }
    } catch (e) {
      console.error("Error reading localStorage", e);
    }
  }, [reservaId]);

  const handleClick = () => {
    try {
      localStorage.setItem(`rated_${reservaId}`, 'true');
    } catch (e) {
      console.error("Error writing to localStorage", e);
    }
    setIsRated(true);
  };

  if (isRated) {
    return (
      <a 
        href={feedbackUrl}
        className="text-[12px] font-medium text-[#10B981] hover:underline flex items-center gap-1"
      >
        <span className="material-symbols-outlined text-[16px]">check_circle</span> Calificado
      </a>
    );
  }

  return (
    <a 
      href={feedbackUrl} 
      onClick={handleClick}
      className="text-[12px] font-bold text-[#F59E0B] hover:underline flex items-center gap-1"
    >
      <span className="material-symbols-outlined text-[16px] fill-current">star</span> Calificar
    </a>
  );
}
