import React, { createContext, useContext, useState } from "react";

interface CameraContextValue {
  isCapturing: boolean;
  setIsCapturing: (v: boolean) => void;
}

const CameraContext = createContext<CameraContextValue>({
  isCapturing: false,
  setIsCapturing: () => {},
});

export function CameraProvider({ children }: { children: React.ReactNode }) {
  const [isCapturing, setIsCapturing] = useState(false);
  return (
    <CameraContext.Provider value={{ isCapturing, setIsCapturing }}>
      {children}
    </CameraContext.Provider>
  );
}

export function useCameraState() {
  return useContext(CameraContext);
}
