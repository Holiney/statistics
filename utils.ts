export const getTodayDateString = () => {
  return new Date().toLocaleDateString('en-GB'); // DD/MM/YYYY format preference
};

export const triggerHaptic = (enabled: boolean) => {
  if (enabled && navigator.vibrate) {
    navigator.vibrate(15);
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
