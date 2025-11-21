/**
 * Blog post data types
 */
export interface BlogAuthor {
  name: string;
  avatar?: string;
  avatarBg?: string;
}

export interface BlogPost {
  id: string;
  title: string;
  description: string;
  category: string;
  author: BlogAuthor;
  date: string;
  bgColor: string;
  coverImage: string;
}
