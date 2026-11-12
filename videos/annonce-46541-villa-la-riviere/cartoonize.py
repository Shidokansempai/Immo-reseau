import onnxruntime as ort, numpy as np, sys, os, glob, cv2
from PIL import Image
model, src, dst = sys.argv[1], sys.argv[2], sys.argv[3]
names = sys.argv[4:] or [os.path.basename(f) for f in sorted(glob.glob(os.path.join(src, "p*.jpg")))]
s = ort.InferenceSession(model)
def gan(a, scale):
    h, w = a.shape[:2]
    W, H = int(w * scale) // 32 * 32, int(h * scale) // 32 * 32
    x = cv2.resize(a, (W, H), interpolation=cv2.INTER_AREA).astype(np.float32)[None] / 127.5 - 1
    y = s.run(None, {s.get_inputs()[0].name: x})[0][0]
    return cv2.resize(((y + 1) * 127.5).clip(0, 255).astype(np.uint8), (w, h), interpolation=cv2.INTER_CUBIC)
for n in names:
    rgb = np.asarray(Image.open(os.path.join(src, n)).convert("RGB"))
    # pre-flatten so the GAN paints flat areas
    flat = rgb.copy()
    for _ in range(3):
        flat = cv2.bilateralFilter(flat, 9, 45, 9)
    a = gan(flat, 0.62)
    a = gan(a, 0.9)  # second pass = stronger anime look
    # keep true colours: GAN lightness, mostly original chroma
    la = cv2.cvtColor(a, cv2.COLOR_RGB2LAB).astype(np.float32)
    lo = cv2.cvtColor(cv2.bilateralFilter(flat, 9, 60, 9), cv2.COLOR_RGB2LAB).astype(np.float32)
    la[..., 1:] = la[..., 1:] * 0.3 + lo[..., 1:] * 0.7
    la[..., 0] = la[..., 0] * 0.8 + lo[..., 0] * 0.2
    a = cv2.cvtColor(la.clip(0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB)
    # mild cel shading
    a = cv2.bilateralFilter(a, 9, 35, 7)
    hsv = cv2.cvtColor(a, cv2.COLOR_RGB2HSV).astype(np.float32)
    hsv[..., 1] = np.clip(hsv[..., 1] * 1.25, 0, 255)
    hsv[..., 2] = np.clip(np.round(hsv[..., 2] / 18) * 18 * 0.35 + hsv[..., 2] * 0.65, 0, 255)
    a = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB)
    # clean ink outlines from structure edges only
    g = cv2.cvtColor(flat, cv2.COLOR_RGB2GRAY)
    g = cv2.GaussianBlur(g, (5, 5), 0)
    e = cv2.Canny(g, 40, 110)
    e = cv2.dilate(e, np.ones((2, 2), np.uint8))
    nlab, lab, st, _ = cv2.connectedComponentsWithStats(e, 8)
    keep = np.isin(lab, np.where(st[:, cv2.CC_STAT_AREA] >= 60)[0][1:])
    dens = cv2.blur(keep.astype(np.float32), (41, 41))
    calm = np.clip(1.6 - dens * 6, 0, 1)  # fade ink where lines are dense (foliage)
    ink = cv2.GaussianBlur(keep.astype(np.float32), (3, 3), 0) * 0.7 * calm
    out = (a.astype(np.float32) * (1 - ink[..., None]) + np.array([35, 28, 30]) * ink[..., None]).astype(np.uint8)
    Image.fromarray(out).save(os.path.join(dst, n), quality=95)
    print(n, flush=True)
