import React, { useState, useRef } from 'react';
import { X, Delete, Divide, Minus, Plus, X as Multiply, Equal, GripHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CalculatorModal({ isOpen, onClose }: CalculatorModalProps) {
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [shouldReset, setShouldReset] = useState(false);
  const constraintsRef = useRef(null);

  const handleNumber = (num: string) => {
    if (display === '0' || shouldReset) {
      setDisplay(num);
      setShouldReset(false);
    } else {
      setDisplay(display + num);
    }
  };

  const handleOperator = (op: string) => {
    setEquation(display + ' ' + op + ' ');
    setShouldReset(true);
  };

  const handleClear = () => {
    setDisplay('0');
    setEquation('');
    setShouldReset(false);
  };

  const handleEqual = () => {
    try {
      const fullEquation = equation + display;
      const parts = fullEquation.split(' ');
      if (parts.length < 3) return;

      const num1 = parseFloat(parts[0]);
      const op = parts[1];
      const num2 = parseFloat(parts[2]);

      let result = 0;
      switch (op) {
        case '+': result = num1 + num2; break;
        case '-': result = num1 - num2; break;
        case '×': result = num1 * num2; break;
        case '÷': result = num1 / num2; break;
      }

      setDisplay(result.toString());
      setEquation('');
      setShouldReset(true);
    } catch (error) {
      setDisplay('Error');
      setEquation('');
      setShouldReset(true);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div ref={constraintsRef} className="fixed inset-0 z-[80] pointer-events-none flex items-center justify-center p-4">
          {/* Backdrop - only clickable to close, doesn't block dragging if we use pointer-events-none on container and auto on modal */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm pointer-events-auto"
          />
          
          <motion.div 
            drag
            dragConstraints={constraintsRef}
            dragMomentum={false}
            dragElastic={0.1}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white w-full max-w-xs rounded-[2.5rem] shadow-2xl overflow-hidden border border-stone-100 pointer-events-auto cursor-default relative"
          >
            <div className="p-6 bg-stone-50/50 border-b border-stone-100 flex items-center justify-between cursor-grab active:cursor-grabbing">
              <div className="flex items-center gap-2">
                <GripHorizontal className="w-4 h-4 text-stone-400" />
                <h3 className="font-serif italic text-xl text-stone-900 select-none">Calculator</h3>
              </div>
              <button 
                onClick={onClose}
                className="p-2 text-stone-400 hover:text-stone-900 rounded-full hover:bg-stone-100 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Display */}
              <div className="bg-stone-900 rounded-2xl p-6 text-right shadow-inner">
                <p className="text-stone-500 text-xs font-mono h-4 mb-1">{equation}</p>
                <p className="text-white text-3xl font-mono truncate">{display}</p>
              </div>

              {/* Keypad */}
              <div className="grid grid-cols-4 gap-2">
                <button onClick={handleClear} className="col-span-2 p-4 bg-rose-50 text-rose-600 rounded-2xl font-bold hover:bg-rose-100 transition-all">AC</button>
                <button onClick={() => setDisplay(display.slice(0, -1) || '0')} className="p-4 bg-stone-100 text-stone-600 rounded-2xl font-bold hover:bg-stone-200 transition-all flex items-center justify-center">
                  <Delete className="w-5 h-5" />
                </button>
                <button onClick={() => handleOperator('÷')} className="p-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all flex items-center justify-center">
                  <Divide className="w-5 h-5" />
                </button>

                {[7, 8, 9].map(n => (
                  <button key={n} onClick={() => handleNumber(n.toString())} className="p-4 bg-stone-50 text-stone-900 rounded-2xl font-bold hover:bg-stone-100 transition-all">{n}</button>
                ))}
                <button onClick={() => handleOperator('×')} className="p-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all flex items-center justify-center">
                  <Multiply className="w-5 h-5" />
                </button>

                {[4, 5, 6].map(n => (
                  <button key={n} onClick={() => handleNumber(n.toString())} className="p-4 bg-stone-50 text-stone-900 rounded-2xl font-bold hover:bg-stone-100 transition-all">{n}</button>
                ))}
                <button onClick={() => handleOperator('-')} className="p-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all flex items-center justify-center">
                  <Minus className="w-5 h-5" />
                </button>

                {[1, 2, 3].map(n => (
                  <button key={n} onClick={() => handleNumber(n.toString())} className="p-4 bg-stone-50 text-stone-900 rounded-2xl font-bold hover:bg-stone-100 transition-all">{n}</button>
                ))}
                <button onClick={() => handleOperator('+')} className="p-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </button>

                <button onClick={() => handleNumber('0')} className="col-span-2 p-4 bg-stone-50 text-stone-900 rounded-2xl font-bold hover:bg-stone-100 transition-all text-left px-8">0</button>
                <button onClick={() => handleNumber('.')} className="p-4 bg-stone-50 text-stone-900 rounded-2xl font-bold hover:bg-stone-100 transition-all">.</button>
                <button onClick={handleEqual} className="p-4 bg-stone-900 text-white rounded-2xl font-bold hover:bg-stone-800 transition-all flex items-center justify-center shadow-lg shadow-stone-900/20">
                  <Equal className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
