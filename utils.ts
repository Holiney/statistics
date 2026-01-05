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