/**
 * Get the appropriate avatar URL for a user, with fallback logic
 * Priority:
 * 1. Custom uploaded avatar (avatar_url from database)
 * 2. OAuth provider avatar (from user_metadata)
 * 3. null (component should show initials)
 */
export function getAvatarUrl(
  dbAvatarUrl?: string | null,
  authAvatarUrl?: string | null
): string | null {
  // Priority 1: Custom uploaded avatar
  if (dbAvatarUrl) {
    return dbAvatarUrl;
  }
  
  // Priority 2: OAuth avatar (Google, etc.)
  if (authAvatarUrl) {
    return authAvatarUrl;
  }
  
  // No avatar available
  return null;
}

/**
 * Get user initials from name for avatar fallback
 * Takes first letter of first two words
 */
export function getUserInitials(name?: string | null): string {
  if (!name) return "?";
  
  const words = name.trim().split(/\s+/);
  if (words.length === 0) return "?";
  
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  }
  
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
}
