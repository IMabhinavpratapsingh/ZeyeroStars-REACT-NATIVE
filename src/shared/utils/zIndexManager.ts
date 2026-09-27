// Global "sabse upar" z-index counter.
//
// Pehle har modal/overlay ka z-index apni JSX mein hardcoded tha - jiska
// koi lena dena nahi tha ki abhi kya khola gaya hai. Isliye jiska number
// bada tha wahi hamesha upar dikhta rehta tha, chahe user ne kuch aur
// baad mein khola ho.
//
// Ab har modal jab khulta hai, yahan se agla (sabse bada) number le
// leta hai - taaki jo SABSE AAKHRI baar khula ho, wahi hamesha sabse
// upar dikhe. Static ordering ka scene hi khatam.
//
// RN NOTE: web mein CSS `z-index` string/number dono chalta tha; RN
// StyleSheet mein `zIndex` sirf number leta hai (jo yeh function waise
// bhi deta hai), aur RN mein sirf zIndex kaafi nahi hota - saath mein
// `position: 'absolute'` bhi dena padta hai component ko tabhi zIndex
// asar karega. Android par zIndex sahi se kaam karne ke liye kabhi
// `elevation` bhi dena padta hai (View style mein `elevation: 10` jaisa) -
// per-component test kar lena.
let current = 1000;

export function getNextZIndex(): number {
  current += 1;
  return current;
}