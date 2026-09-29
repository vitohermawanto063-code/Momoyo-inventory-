import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeGeneratorProps {
  value: string;
  format?: 'CODE128' | 'EAN13' | 'UPC' | 'pharmacode';
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
  className?: string;
}

export const BarcodeGenerator: React.FC<BarcodeGeneratorProps> = ({
  value,
  format = 'CODE128',
  width = 2,
  height = 60,
  displayValue = true,
  fontSize = 14,
  className = '',
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format,
          width,
          height,
          displayValue,
          fontSize,
          margin: 6,
          lineColor: '#171717',
          background: '#ffffff',
        });
      } catch (err) {
        console.warn('JsBarcode render failed for format, trying CODE128 fallback:', err);
        try {
          JsBarcode(svgRef.current, value, {
            format: 'CODE128',
            width,
            height,
            displayValue,
            fontSize,
            margin: 6,
            lineColor: '#171717',
            background: '#ffffff',
          });
        } catch (fallbackErr) {
          console.error('Failed to render barcode:', fallbackErr);
        }
      }
    }
  }, [value, format, width, height, displayValue, fontSize]);

  return <svg ref={svgRef} className={`max-w-full inline-block ${className}`} />;
};
