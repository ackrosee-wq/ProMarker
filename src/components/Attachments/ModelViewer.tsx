import React, { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Center, Grid } from '@react-three/drei';
import { Loader2 } from 'lucide-react';

interface ModelViewerProps {
  src: string;
  className?: string;
}

interface ModelProps {
  src: string;
  onError: () => void;
}

const Model: React.FC<ModelProps> = ({ src, onError }) => {
  try {
    const { scene } = useGLTF(src);
    return (
      <Center>
        <primitive object={scene} />
      </Center>
    );
  } catch {
    onError();
    return null;
  }
};

const LoadingSpinner: React.FC = () => (
  <div className="absolute inset-0 flex items-center justify-center">
    <Loader2 size={18} className="text-[#5b9fd6] animate-spin" />
  </div>
);

export const ModelViewer: React.FC<ModelViewerProps> = ({ src, className = '' }) => {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className={`bg-[#252525] rounded-lg flex items-center justify-center ${className}`} style={{ minHeight: 120 }}>
        <span className="text-[10px] text-[#d8d8d8]/40">Failed to load 3D model</span>
      </div>
    );
  }

  return (
    <div className={`bg-[#1a1a1a] rounded-lg overflow-hidden relative ${className}`} style={{ minHeight: 160 }}>
      <Suspense fallback={<LoadingSpinner />}>
        <Canvas
          camera={{ position: [2, 2, 2], fov: 50 }}
          style={{ width: '100%', height: '100%', minHeight: 160 }}
        >
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 8, 5]} intensity={0.8} />
          <Model src={src} onError={() => setError(true)} />
          <Grid
            infiniteGrid
            cellSize={0.5}
            cellThickness={0.5}
            cellColor="#333"
            sectionSize={2}
            sectionThickness={1}
            sectionColor="#444"
            fadeDistance={10}
            fadeStrength={1}
            position={[0, -0.5, 0]}
          />
          <OrbitControls
            enableDamping
            dampingFactor={0.1}
            minDistance={1}
            maxDistance={20}
            makeDefault
          />
        </Canvas>
      </Suspense>
    </div>
  );
};
