export interface AssetValidationResult {
  hasAlpha: boolean;
  visibleBounds: { x: number, y: number, width: number, height: number };
  opaquePixelRatio: number;
  transparentPixelRatio: number;
  suspectedBakedCheckerboard: boolean;
  suspectedSolidBackground: boolean;
  recommendedAction: "ok" | "trim" | "reject" | "manual_review";
  warnings: string[];
}

export async function validateImageAsset(img: HTMLImageElement): Promise<AssetValidationResult> {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  
  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  const data = imageData.data;
  
  let hasAlpha = false;
  let opaqueCount = 0;
  let transparentCount = 0;
  let minX = img.width, minY = img.height, maxX = 0, maxY = 0;
  
  // Checkerboard detection (Simplified: check if there's a repeating pattern of white/gray pixels in "transparent" areas)
  let suspectedBakedCheckerboard = false;
  let whitePixels = 0;
  let grayPixels = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i+1];
    const b = data[i+2];
    const a = data[i+3];
    
    if (a < 255) hasAlpha = true;
    
    if (a > 10) {
      opaqueCount++;
      const x = (i / 4) % img.width;
      const y = Math.floor((i / 4) / img.width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      
      // Look for white/gray baked pixels
      if (r === 255 && g === 255 && b === 255) whitePixels++;
      if (r > 190 && r < 210 && g > 190 && g < 210 && b > 190 && b < 210) grayPixels++;
    } else {
      transparentCount++;
    }
  }
  
  const totalPixels = img.width * img.height;
  const opaquePixelRatio = opaqueCount / totalPixels;
  const transparentPixelRatio = transparentCount / totalPixels;
  
  // Heuristic for baked checkerboard: high count of specific grays/whites but NO alpha
  if (!hasAlpha && (whitePixels + grayPixels) / totalPixels > 0.3) {
    suspectedBakedCheckerboard = true;
  }
  
  const suspectedSolidBackground = !hasAlpha && opaquePixelRatio > 0.95;
  
  const warnings: string[] = [];
  if (suspectedBakedCheckerboard) warnings.push("This asset contains baked checkerboard background. It is not a real transparent PNG.");
  if (suspectedSolidBackground) warnings.push("This asset has a solid background. Use manual extraction first.");
  if (!hasAlpha) warnings.push("This image does not have real alpha transparency.");
  
  let recommendedAction: AssetValidationResult["recommendedAction"] = "ok";
  if (suspectedBakedCheckerboard || suspectedSolidBackground) recommendedAction = "reject";
  else if (opaquePixelRatio < 0.3) recommendedAction = "trim";

  return {
    hasAlpha,
    visibleBounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
    opaquePixelRatio,
    transparentPixelRatio,
    suspectedBakedCheckerboard,
    suspectedSolidBackground,
    recommendedAction,
    warnings
  };
}

export async function trimToAlphaBounds(img: HTMLImageElement): Promise<{ dataUrl: string, bounds: any }> {
  const validation = await validateImageAsset(img);
  const { x, y, width, height } = validation.visibleBounds;
  
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  
  ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
  
  return {
    dataUrl: canvas.toDataURL('image/png'),
    bounds: validation.visibleBounds
  };
}
