let gsapPromise = null;

export const loadGsap = () => {
  if (!gsapPromise) {
    gsapPromise = import('gsap').then(m => m.default || m);
  }
  return gsapPromise;
};

export default loadGsap;
