import { Link } from 'react-router-dom';

/**
 * variant: "primary" (green), "outline" (cyan outline) or "quiet" (no chrome).
 * Pass `to` to render a router link that looks like a button.
 */
export default function Button({ variant = 'primary', size = 'md', to, className = '', children, ...rest }) {
  const classes = `btn btn--${variant} btn--${size} ${className}`.trim();
  if (to) {
    return (
      <Link to={to} className={classes} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={classes} {...rest}>
      {children}
    </button>
  );
}
