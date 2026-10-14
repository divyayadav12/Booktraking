import React from 'react';
import Barcode from 'react-barcode';

interface BarcodeDisplayProps {
  value: string;
  label?: string;
  width?: number;
  height?: number;
  fontSize?: number;
}

export const BarcodeDisplay: React.FC<BarcodeDisplayProps> = ({
  value,
  label,
  width = 1.8,
  height = 60,
  fontSize = 12,
}) => {
  if (!value) return null;
  return (
    <div className="flex flex-col items-center">
      {label && <p className="text-xs font-semibold text-gray-500 mb-1">{label}</p>}
      <Barcode
        value={value}
        width={width}
        height={height}
        fontSize={fontSize}
        margin={4}
        displayValue={true}
        background="transparent"
      />
    </div>
  );
};
