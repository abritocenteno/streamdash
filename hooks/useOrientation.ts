import { useEffect, useState } from "react";
import { Dimensions } from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";

export type Orientation = "portrait" | "landscape";

export function useOrientation(): Orientation {
  const getDimensions = () => {
    const { width, height } = Dimensions.get("window");
    return width > height ? "landscape" : "portrait";
  };

  const [orientation, setOrientation] = useState<Orientation>(getDimensions);

  useEffect(() => {
    const sub = ScreenOrientation.addOrientationChangeListener((evt) => {
      const o = evt.orientationInfo.orientation;
      const isLandscape =
        o === ScreenOrientation.Orientation.LANDSCAPE_LEFT ||
        o === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
      setOrientation(isLandscape ? "landscape" : "portrait");
    });

    // Also listen to dimension changes as a fallback
    const dimSub = Dimensions.addEventListener("change", ({ window }) => {
      setOrientation(window.width > window.height ? "landscape" : "portrait");
    });

    return () => {
      ScreenOrientation.removeOrientationChangeListener(sub);
      dimSub.remove();
    };
  }, []);

  return orientation;
}
