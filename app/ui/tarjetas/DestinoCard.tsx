import React from 'react';

interface DestinoCardProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  nombre: string;
  ubicacion_lat_long: string;
}

export const DestinoCard = ({ nombre, ubicacion_lat_long, className = '', ...props }: DestinoCardProps) => {
  return (
    <button className={`w-full text-left group ${className}`} {...props}>
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white border border-gray-200 rounded-xl shadow-sm hover:shadow-lg hover:border-blue-300 transition-all duration-200 transform hover:scale-102">
        <div className="flex items-center gap-3 flex-1">
          <div className="bg-blue-100 p-3 rounded-full text-2xl group-hover:scale-110 transition-transform duration-200">🚐</div>
          <div className="flex flex-col gap-1">
            <span className="font-bold text-gray-900 text-base leading-tight">{nombre}</span>
            <span className="text-sm text-gray-500 font-medium flex items-center gap-1">
              📍 {ubicacion_lat_long}
            </span>
          </div>
        </div>
        <div className="text-blue-600 text-xl group-hover:translate-x-1 transition-transform">→</div>
      </div>
    </button>
  );
};