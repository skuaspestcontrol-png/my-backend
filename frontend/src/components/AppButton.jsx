import React from 'react';

const sizeMap = {
  sm: {
    button: 'min-h-9 px-3 py-2 text-sm gap-2 rounded-lg',
    icon: 'h-4 w-4'
  },
  md: {
    button: 'min-h-11 px-4 py-2.5 text-sm md:text-base gap-2.5 rounded-xl',
    icon: 'h-5 w-5'
  },
  lg: {
    button: 'min-h-12 px-5 py-3 text-base md:text-lg gap-3 rounded-xl',
    icon: 'h-5 w-5 md:h-6 md:w-6'
  }
};

const variantMap = {
  primary:
    'bg-[#9F174D] text-white border border-[#9F174D] shadow-sm hover:bg-[#831843] hover:border-[#831843] active:bg-[#701A3D] focus-visible:ring-[#9F174D]/40',
  secondary:
    'bg-[#FDF2F8] text-[#9F174D] border border-[#FBCFE8] shadow-sm hover:bg-[#FCE7F3] active:bg-[#FBCFE8] focus-visible:ring-[#9F174D]/30',
  outline:
    'bg-white text-[#9F174D] border border-[#9F174D]/45 shadow-sm hover:bg-[#FDF2F8] hover:border-[#9F174D] active:bg-[#FCE7F3] focus-visible:ring-[#9F174D]/35',
  danger:
    'bg-red-600 text-white border border-red-600 shadow-sm hover:bg-red-700 hover:border-red-700 active:bg-red-800 focus-visible:ring-red-500/35'
};

const spinnerSizeMap = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5'
};

const cn = (...parts) => parts.filter(Boolean).join(' ');

const withIconSize = (icon, iconClassName) => {
  if (!React.isValidElement(icon)) return null;
  const merged = cn(icon.props.className, iconClassName);
  return React.cloneElement(icon, {
    className: merged,
    'aria-hidden': true
  });
};

export default function AppButton({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  iconLeft,
  iconRight,
  className = '',
  disabled = false,
  type = 'button',
  ...rest
}) {
  const safeSize = sizeMap[size] ? size : 'md';
  const safeVariant = variantMap[variant] ? variant : 'primary';
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading ? 'true' : 'false'}
      className={cn(
        'relative inline-flex max-w-full items-center justify-center whitespace-normal text-left font-semibold tracking-[0.01em] transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60',
        fullWidth ? 'w-full' : 'w-auto',
        sizeMap[safeSize].button,
        variantMap[safeVariant],
        className
      )}
      {...rest}
    >
      {loading ? (
        <span
          className={cn(
            'inline-block animate-spin rounded-full border-2 border-current border-r-transparent',
            spinnerSizeMap[safeSize]
          )}
        />
      ) : iconLeft ? (
        withIconSize(iconLeft, sizeMap[safeSize].icon)
      ) : null}

      <span className="truncate">{children}</span>

      {!loading && iconRight ? withIconSize(iconRight, sizeMap[safeSize].icon) : null}
    </button>
  );
}

