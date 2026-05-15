type AvatarProps = {
  label: string;
  size?: 'sm' | 'md' | 'lg';
};

export default function Avatar({ label, size = 'md' }: AvatarProps) {
  return <span className={`avatar avatar-${size}`}>{label.slice(0, 2).toUpperCase()}</span>;
}
