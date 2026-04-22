import jsQR from 'jsqr'

type BarcodeDetectorResult = {
  rawValue?: string
}

type BarcodeDetectorLike = {
  detect(source: ImageBitmapSource): Promise<BarcodeDetectorResult[]>
}

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike

const MAX_CANVAS_SIDE = 4096

function normalizeDecodedValue(value: unknown) {
  return String(value || '').trim()
}

function getSourceSize(source: CanvasImageSource) {
  if (source instanceof HTMLVideoElement) {
    return {
      width: source.videoWidth || source.clientWidth,
      height: source.videoHeight || source.clientHeight,
    }
  }

  if (source instanceof HTMLImageElement) {
    return {
      width: source.naturalWidth || source.width,
      height: source.naturalHeight || source.height,
    }
  }

  if (source instanceof SVGImageElement) {
    return {
      width: source.width.baseVal.value,
      height: source.height.baseVal.value,
    }
  }

  const sizedSource = source as { width?: number; height?: number; displayWidth?: number; displayHeight?: number }

  return {
    width: sizedSource.width || sizedSource.displayWidth || 0,
    height: sizedSource.height || sizedSource.displayHeight || 0,
  }
}

async function decodeWithNativeDetector(source: ImageBitmapSource) {
  const Detector = (window as Window & { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector
  if (!Detector) return ''

  try {
    const detector = new Detector({ formats: ['qr_code'] })
    const codes = await detector.detect(source)
    return normalizeDecodedValue(codes.find((item) => normalizeDecodedValue(item.rawValue))?.rawValue)
  } catch {
    return ''
  }
}

function decodeWithCanvas(source: CanvasImageSource) {
  const size = getSourceSize(source)
  if (!size.width || !size.height) return ''

  const scale = Math.min(1, MAX_CANVAS_SIDE / size.width, MAX_CANVAS_SIDE / size.height)
  const width = Math.max(1, Math.round(size.width * scale))
  const height = Math.max(1, Math.round(size.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return ''

  context.drawImage(source, 0, 0, width, height)
  const imageData = context.getImageData(0, 0, width, height)
  const result = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth',
  })

  return normalizeDecodedValue(result?.data)
}

export async function decodeQrFromImageFile(file: File) {
  const bitmap = await createImageBitmap(file)
  try {
    const nativeValue = await decodeWithNativeDetector(bitmap)
    if (nativeValue) return nativeValue
    return decodeWithCanvas(bitmap)
  } finally {
    bitmap.close()
  }
}

export function decodeQrFromCanvasImageSource(source: CanvasImageSource) {
  return decodeWithCanvas(source)
}
