// Kisi bhi SVG file ka "actual drawing kahan hai" (bounding box) nikaal ke
// deta hai - taaki thumbnail me sirf usi hisse par zoom kiya ja sake, chahe
// original canvas (poora avatar ka size) kitna bhi bada ho.
//
// RN CHANGE / LIMITATION: web version browser ke real DOM renderer mein
// SVG ko attach karke `getBBox()` se ACTUAL drawn pixels naapta tha (jahan
// se drawing shuru hoti hai, wahi se crop). RN mein koi DOM/renderer
// available nahi hai (react-native-svg bhi getBBox() expose nahi karta),
// isliye yeh real crop-detection RN mein possible NAHI hai bina extra
// tooling ke.
//
// Yeh fallback version sirf SVG ke `viewBox` attribute ko parse karta hai
// (plain text/regex se, DOM ki zaroorat nahi) aur POORA canvas hi
// bounding box maan leta hai - matlab thumbnail zoom/crop nahi hoga,
// bas poora SVG dikhega jaisa hai.
//
// AGAR crop zaroor chahiye (jaise pehle web mein tha), to do options hain:
//   1) Build-time par ek Node script chalao (jsdom + svg-path-bbox jaisi
//      library se) jo har item SVG ka real bbox nikaal ke ek static JSON
//      (assets/svgBBoxCache.json) mein save kar de - phir yeh function
//      us JSON se lookup kare (fetch/regex ki zaroorat hi na pade).
//   2) Ya har SVG banate/export karte waqt (Figma/Illustrator se) hi
//      viewBox ko tight-crop kar ke export karo, taaki viewBox == actual
//      drawing ho aur alag se bbox nikaalna hi na pade.
// Bata dena agar option (1) wala script bana du.

const cache = new Map<string, SvgLayout | null>();

export interface SvgLayout {
  fullW: number;
  fullH: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Returns: { fullW, fullH, x, y, width, height } ya null (agar viewBox na mila)
 * NOTE: x/y/width/height abhi poore canvas (0,0,fullW,fullH) ke barabar
 * hain - real crop nahi hai, upar wala comment dekho.
 */
export async function getSvgLayout(url: string, padding = 6): Promise<SvgLayout | null> {
  if (!url) return null;
  if (cache.has(url)) return cache.get(url) ?? null;

  try {
    const res = await fetch(url);
    const text = await res.text();

    const vbMatch = text.match(/viewBox=["']([^"']+)["']/i);
    let fullW: number;
    let fullH: number;

    if (vbMatch) {
      const parts = vbMatch[1].trim().split(/\s+/).map(Number);
      fullW = parts[2];
      fullH = parts[3];
    } else {
      const wMatch = text.match(/<svg[^>]*\swidth=["']([\d.]+)/i);
      const hMatch = text.match(/<svg[^>]*\sheight=["']([\d.]+)/i);
      fullW = wMatch ? parseFloat(wMatch[1]) : 100;
      fullH = hMatch ? parseFloat(hMatch[1]) : 100;
    }

    const result: SvgLayout = {
      fullW,
      fullH,
      x: 0,
      y: 0,
      width: fullW,
      height: fullH,
    };

    cache.set(url, result);
    return result;
  } catch (e) {
    console.error('SVG layout measure error:', e);
    cache.set(url, null);
    return null;
  }
}