declare module 'react-native-nodemediaclient' {
  import React from 'react';

  interface NodePublisherProps {
    style?: object;
    url?: string;
    audioParam?: object;
    videoParam?: object;
    frontCamera?: boolean;
    videoOrientation?: number;
    keyFrameInterval?: number;
    onEvent?: (code: number, msg: string) => void;
  }

  class NodePublisher extends React.Component<NodePublisherProps> {
    start(): void;
    stop(): void;
    startPreview(): void;
    stopPreview(): void;
  }

  export { NodePublisher };
}
