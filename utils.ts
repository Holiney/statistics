export const getTodayDateString = () => {
  return new Date().toLocaleDateString('en-GB'); // DD/MM/YYYY format preference
};

export const triggerHaptic = (enabled: boolean) => {
  if (enabled && typeof navigator !== 'undefined' && navigator.vibrate) {
    // Increased to 50ms as some Android devices ignore very short pulses (<20ms)
    navigator.vibrate(50);
  }
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
};

export const generateId = () => Math.random().toString(36).substr(2, 9);

export const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800; // Resize to max 800px to save LocalStorage space
        const scale = MAX_WIDTH / img.width;
        
        // If image is smaller than max, don't upscale
        const finalScale = scale < 1 ? scale : 1;
        
        canvas.width = img.width * finalScale;
        canvas.height = img.height * finalScale;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject('Canvas context failed');
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Compress to JPEG at 0.6 quality
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};