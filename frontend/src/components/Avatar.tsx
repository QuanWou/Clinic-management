type AvatarProps = {
  label: string;
  size?: 'sm' | 'md' | 'lg';
};

export default function Avatar({ label, size = 'md' }: AvatarProps) {
  const initials = getInitials(label);
  return (
    <span className={`avatar avatar-${size}`} role="img" aria-label={label} title={label}>
      {initials}
    </span>
  );
}

function getInitials(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase();
  return (words[0] ?? '?').slice(0, 2).toUpperCase();
}
