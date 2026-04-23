import React from 'react';
import { ViewStyle } from 'react-native';

declare module 'react-native-nodemediaclient' {
  interface NodePublisherProps {
    style?: ViewStyle | object;
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
