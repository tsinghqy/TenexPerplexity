export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type MessageRole = 'user' | 'assistant'
export type LinkType = 'manual' | 'auto_suggested' | 'accepted'

export interface Database {
  public: {
    Tables: {
      chats: {
        Row: {
          id: string
          user_id: string
          title: string | null
          root_node_id: string | null
          is_expanded: boolean | null
          position_x: number | null
          position_y: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title?: string | null
          root_node_id?: string | null
          is_expanded?: boolean | null
          position_x?: number | null
          position_y?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string | null
          root_node_id?: string | null
          is_expanded?: boolean | null
          position_x?: number | null
          position_y?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      node_parent_paths: {
        Row: {
          node_id: string
          chat_id: string
          user_id: string
          path: string[]
          depth: number
          root_node_id: string | null
          parent_node_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          node_id: string
          chat_id: string
          user_id: string
          path: string[]
          depth?: number
          root_node_id?: string | null
          parent_node_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          node_id?: string
          chat_id?: string
          user_id?: string
          path?: string[]
          depth?: number
          root_node_id?: string | null
          parent_node_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      nodes: {
        Row: {
          id: string
          chat_id: string
          user_id: string
          parent_id: string | null
          role: MessageRole
          content: string
          embedding: number[] | null
          position_x: number | null
          position_y: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          chat_id: string
          user_id: string
          parent_id?: string | null
          role: MessageRole
          content: string
          embedding?: number[] | null
          position_x?: number | null
          position_y?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          chat_id?: string
          user_id?: string
          parent_id?: string | null
          role?: MessageRole
          content?: string
          embedding?: number[] | null
          position_x?: number | null
          position_y?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      node_links: {
        Row: {
          id: string
          source_node_id: string
          target_node_id: string
          user_id: string
          link_type: LinkType | null
          created_at: string
        }
        Insert: {
          id?: string
          source_node_id: string
          target_node_id: string
          user_id: string
          link_type?: LinkType | null
          created_at?: string
        }
        Update: {
          id?: string
          source_node_id?: string
          target_node_id?: string
          user_id?: string
          link_type?: LinkType | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      search_chat_nodes_safe: {
        Args: {
          p_user_id: string
          p_chat_id: string
          p_query_embedding: number[]
          p_limit?: number
          p_similarity_threshold?: number
        }
        Returns: {
          id: string
          chat_id: string
          user_id: string
          parent_id: string | null
          role: MessageRole
          content: string
          similarity: number
          created_at: string
        }[]
      }
      get_nodes_needing_embeddings: {
        Args: {
          p_user_id: string
          p_limit?: number
        }
        Returns: {
          id: string
          content: string
          created_at: string
        }[]
      }
      get_node_parent_tree: {
        Args: {
          p_node_id: string
          p_user_id: string
        }
        Returns: {
          id: string
          chat_id: string
          user_id: string
          parent_id: string | null
          role: MessageRole
          content: string
          created_at: string
          depth: number
        }[]
      }
    }
    Enums: {
      message_role: MessageRole
      link_type: LinkType
    }
    CompositeTypes: Record<string, never>
  }
}
