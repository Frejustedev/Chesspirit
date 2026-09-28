// Fichier généré par scripts/gen-types.mjs — ne pas modifier à la main.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: { PostgrestVersion: "12" };
  public: {
    Tables: {
      ambassadors: {
        Row: {
          profile_id: string;
          city: string | null;
          motivation: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          profile_id: string;
          city?: string | null;
          motivation?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          profile_id?: string;
          city?: string | null;
          motivation?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "ambassadors_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: true; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      app_settings: {
        Row: {
          key: string;
          value: Json;
          is_public: boolean;
          description: string | null;
          id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          is_public?: boolean;
          description?: string | null;
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: Json;
          is_public?: boolean;
          description?: string | null;
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      arbiter_profiles: {
        Row: {
          id: string;
          profile_id: string;
          title: string | null;
          zone: string | null;
          availability: string | null;
          languages: string[];
          is_public: boolean;
          verified: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          title?: string | null;
          zone?: string | null;
          availability?: string | null;
          languages?: string[];
          is_public?: boolean;
          verified?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          title?: string | null;
          zone?: string | null;
          availability?: string | null;
          languages?: string[];
          is_public?: boolean;
          verified?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "arbiter_profiles_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: true; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      articles: {
        Row: {
          id: string;
          slug: string;
          title: Json;
          excerpt: Json;
          body: Json;
          tags: string[];
          tournament_id: string | null;
          status: string;
          published_at: string | null;
          author_id: string | null;
          is_demo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: Json;
          excerpt?: Json;
          body?: Json;
          tags?: string[];
          tournament_id?: string | null;
          status?: string;
          published_at?: string | null;
          author_id?: string | null;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: Json;
          excerpt?: Json;
          body?: Json;
          tags?: string[];
          tournament_id?: string | null;
          status?: string;
          published_at?: string | null;
          author_id?: string | null;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "articles_tournament_id_fkey"; columns: ["tournament_id"]; isOneToOne: false; referencedRelation: "tournaments"; referencedColumns: ["id"] }, { foreignKeyName: "articles_author_id_fkey"; columns: ["author_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_user_id: string | null;
          action: string;
          object_type: string;
          object_id: string | null;
          before: Json | null;
          after: Json | null;
          ip: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          actor_user_id?: string | null;
          action: string;
          object_type: string;
          object_id?: string | null;
          before?: Json | null;
          after?: Json | null;
          ip?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          actor_user_id?: string | null;
          action?: string;
          object_type?: string;
          object_id?: string | null;
          before?: Json | null;
          after?: Json | null;
          ip?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      availability_slots: {
        Row: {
          id: string;
          coach_id: string;
          offer_id: string | null;
          starts_at: string;
          ends_at: string;
          modality: string;
          location: string | null;
          capacity: number;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          coach_id: string;
          offer_id?: string | null;
          starts_at: string;
          ends_at: string;
          modality: string;
          location?: string | null;
          capacity?: number;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          coach_id?: string;
          offer_id?: string | null;
          starts_at?: string;
          ends_at?: string;
          modality?: string;
          location?: string | null;
          capacity?: number;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "availability_slots_coach_id_fkey"; columns: ["coach_id"]; isOneToOne: false; referencedRelation: "coach_profiles"; referencedColumns: ["id"] }, { foreignKeyName: "availability_slots_offer_id_fkey"; columns: ["offer_id"]; isOneToOne: false; referencedRelation: "offers"; referencedColumns: ["id"] }];
      };
      award_categories: {
        Row: {
          id: string;
          edition_id: string;
          name: Json;
          description: Json;
          position: number;
        };
        Insert: {
          id?: string;
          edition_id: string;
          name: Json;
          description?: Json;
          position?: number;
        };
        Update: {
          id?: string;
          edition_id?: string;
          name?: Json;
          description?: Json;
          position?: number;
        };
        Relationships: [{ foreignKeyName: "award_categories_edition_id_fkey"; columns: ["edition_id"]; isOneToOne: false; referencedRelation: "award_editions"; referencedColumns: ["id"] }];
      };
      award_editions: {
        Row: {
          id: string;
          year: number;
          slug: string;
          title: Json;
          status: string;
          voting_ends_at: string | null;
          is_demo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          year: number;
          slug: string;
          title: Json;
          status?: string;
          voting_ends_at?: string | null;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          year?: number;
          slug?: string;
          title?: Json;
          status?: string;
          voting_ends_at?: string | null;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      award_nominees: {
        Row: {
          id: string;
          category_id: string;
          profile_id: string | null;
          name: string;
          description: string | null;
        };
        Insert: {
          id?: string;
          category_id: string;
          profile_id?: string | null;
          name: string;
          description?: string | null;
        };
        Update: {
          id?: string;
          category_id?: string;
          profile_id?: string | null;
          name?: string;
          description?: string | null;
        };
        Relationships: [{ foreignKeyName: "award_nominees_category_id_fkey"; columns: ["category_id"]; isOneToOne: false; referencedRelation: "award_categories"; referencedColumns: ["id"] }, { foreignKeyName: "award_nominees_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      award_votes: {
        Row: {
          category_id: string;
          voter_id: string;
          nominee_id: string;
          created_at: string;
        };
        Insert: {
          category_id: string;
          voter_id: string;
          nominee_id: string;
          created_at?: string;
        };
        Update: {
          category_id?: string;
          voter_id?: string;
          nominee_id?: string;
          created_at?: string;
        };
        Relationships: [{ foreignKeyName: "award_votes_category_id_fkey"; columns: ["category_id"]; isOneToOne: false; referencedRelation: "award_categories"; referencedColumns: ["id"] }, { foreignKeyName: "award_votes_voter_id_fkey"; columns: ["voter_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }, { foreignKeyName: "award_votes_nominee_id_fkey"; columns: ["nominee_id"]; isOneToOne: false; referencedRelation: "award_nominees"; referencedColumns: ["id"] }];
      };
      badges: {
        Row: {
          code: string;
          name: Json;
          description: Json;
          category: string;
          icon: string;
          position: number;
          created_at: string;
        };
        Insert: {
          code: string;
          name: Json;
          description?: Json;
          category?: string;
          icon?: string;
          position?: number;
          created_at?: string;
        };
        Update: {
          code?: string;
          name?: Json;
          description?: Json;
          category?: string;
          icon?: string;
          position?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      board_results: {
        Row: {
          id: string;
          team_match_id: string;
          board: number;
          white_id: string | null;
          black_id: string | null;
          home_is_white: boolean;
          result: Database["public"]["Enums"]["game_result"] | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_match_id: string;
          board: number;
          white_id?: string | null;
          black_id?: string | null;
          home_is_white: boolean;
          result?: Database["public"]["Enums"]["game_result"] | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          team_match_id?: string;
          board?: number;
          white_id?: string | null;
          black_id?: string | null;
          home_is_white?: boolean;
          result?: Database["public"]["Enums"]["game_result"] | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "board_results_team_match_id_fkey"; columns: ["team_match_id"]; isOneToOne: false; referencedRelation: "team_matches"; referencedColumns: ["id"] }, { foreignKeyName: "board_results_white_id_fkey"; columns: ["white_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }, { foreignKeyName: "board_results_black_id_fkey"; columns: ["black_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      bookings: {
        Row: {
          id: string;
          offer_id: string;
          slot_id: string;
          coach_id: string;
          student_id: string;
          booked_by: string | null;
          status: string;
          amount_xof: number;
          commission_xof: number;
          meeting_url: string | null;
          student_notes: string | null;
          reminder_sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          offer_id: string;
          slot_id: string;
          coach_id: string;
          student_id: string;
          booked_by?: string | null;
          status: string;
          amount_xof: number;
          commission_xof?: number;
          meeting_url?: string | null;
          student_notes?: string | null;
          reminder_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          offer_id?: string;
          slot_id?: string;
          coach_id?: string;
          student_id?: string;
          booked_by?: string | null;
          status?: string;
          amount_xof?: number;
          commission_xof?: number;
          meeting_url?: string | null;
          student_notes?: string | null;
          reminder_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "bookings_offer_id_fkey"; columns: ["offer_id"]; isOneToOne: false; referencedRelation: "offers"; referencedColumns: ["id"] }, { foreignKeyName: "bookings_slot_id_fkey"; columns: ["slot_id"]; isOneToOne: false; referencedRelation: "availability_slots"; referencedColumns: ["id"] }, { foreignKeyName: "bookings_coach_id_fkey"; columns: ["coach_id"]; isOneToOne: false; referencedRelation: "coach_profiles"; referencedColumns: ["id"] }, { foreignKeyName: "bookings_student_id_fkey"; columns: ["student_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      coach_applications: {
        Row: {
          id: string;
          profile_id: string;
          experience: string;
          languages: string[];
          modalities: string[];
          city: string | null;
          credentials_note: string | null;
          status: string;
          reviewed_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          experience: string;
          languages?: string[];
          modalities?: string[];
          city?: string | null;
          credentials_note?: string | null;
          status?: string;
          reviewed_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          experience?: string;
          languages?: string[];
          modalities?: string[];
          city?: string | null;
          credentials_note?: string | null;
          status?: string;
          reviewed_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "coach_applications_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      coach_payout_details: {
        Row: {
          id: string;
          coach_id: string;
          method: string;
          account: string;
          holder_name: string | null;
          ifu: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          coach_id: string;
          method?: string;
          account: string;
          holder_name?: string | null;
          ifu?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          coach_id?: string;
          method?: string;
          account?: string;
          holder_name?: string | null;
          ifu?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "coach_payout_details_coach_id_fkey"; columns: ["coach_id"]; isOneToOne: true; referencedRelation: "coach_profiles"; referencedColumns: ["id"] }];
      };
      coach_profiles: {
        Row: {
          id: string;
          profile_id: string;
          slug: string;
          headline: Json;
          bio: Json;
          languages: string[];
          modalities: string[];
          levels: string[];
          specialties: string[];
          city: string | null;
          zone: string | null;
          status: string;
          is_chesspirit: boolean;
          rating_avg: number | null;
          reviews_count: number;
          is_demo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          slug: string;
          headline?: Json;
          bio?: Json;
          languages?: string[];
          modalities?: string[];
          levels?: string[];
          specialties?: string[];
          city?: string | null;
          zone?: string | null;
          status?: string;
          is_chesspirit?: boolean;
          rating_avg?: number | null;
          reviews_count?: number;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          slug?: string;
          headline?: Json;
          bio?: Json;
          languages?: string[];
          modalities?: string[];
          levels?: string[];
          specialties?: string[];
          city?: string | null;
          zone?: string | null;
          status?: string;
          is_chesspirit?: boolean;
          rating_avg?: number | null;
          reviews_count?: number;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "coach_profiles_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: true; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      coach_reviews: {
        Row: {
          id: string;
          booking_id: string;
          coach_id: string;
          student_id: string;
          stars: number;
          comment: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          coach_id: string;
          student_id: string;
          stars: number;
          comment?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          booking_id?: string;
          coach_id?: string;
          student_id?: string;
          stars?: number;
          comment?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "coach_reviews_booking_id_fkey"; columns: ["booking_id"]; isOneToOne: true; referencedRelation: "bookings"; referencedColumns: ["id"] }, { foreignKeyName: "coach_reviews_coach_id_fkey"; columns: ["coach_id"]; isOneToOne: false; referencedRelation: "coach_profiles"; referencedColumns: ["id"] }, { foreignKeyName: "coach_reviews_student_id_fkey"; columns: ["student_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      consents: {
        Row: {
          id: string;
          profile_id: string;
          type: Database["public"]["Enums"]["consent_type"];
          version: string;
          granted: boolean;
          granted_at: string;
          withdrawn_at: string | null;
          granted_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          type: Database["public"]["Enums"]["consent_type"];
          version: string;
          granted: boolean;
          granted_at?: string;
          withdrawn_at?: string | null;
          granted_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          type?: Database["public"]["Enums"]["consent_type"];
          version?: string;
          granted?: boolean;
          granted_at?: string;
          withdrawn_at?: string | null;
          granted_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "consents_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      contact_messages: {
        Row: {
          id: string;
          name: string;
          email: string | null;
          phone: string | null;
          topic: string | null;
          message: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email?: string | null;
          phone?: string | null;
          topic?: string | null;
          message: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string | null;
          phone?: string | null;
          topic?: string | null;
          message?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      countries: {
        Row: {
          code: string;
          name: Json;
          phone_prefix: string;
          currency: string;
          timezone: string;
          enabled: boolean;
          position: number;
          updated_at: string;
        };
        Insert: {
          code: string;
          name: Json;
          phone_prefix: string;
          currency?: string;
          timezone: string;
          enabled?: boolean;
          position?: number;
          updated_at?: string;
        };
        Update: {
          code?: string;
          name?: Json;
          phone_prefix?: string;
          currency?: string;
          timezone?: string;
          enabled?: boolean;
          position?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      data_requests: {
        Row: {
          id: string;
          profile_id: string;
          type: string;
          status: string;
          details: string | null;
          processed_by: string | null;
          processed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          type: string;
          status?: string;
          details?: string | null;
          processed_by?: string | null;
          processed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          type?: string;
          status?: string;
          details?: string | null;
          processed_by?: string | null;
          processed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "data_requests_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      feature_flags: {
        Row: {
          id: string;
          key: string;
          enabled: boolean;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          enabled?: boolean;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          enabled?: boolean;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      fide_ratings: {
        Row: {
          id: string;
          fide_id: string;
          period: string;
          name: string | null;
          federation: string | null;
          title: string | null;
          standard: number | null;
          rapid: number | null;
          blitz: number | null;
          birth_year: number | null;
          sex: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          fide_id: string;
          period: string;
          name?: string | null;
          federation?: string | null;
          title?: string | null;
          standard?: number | null;
          rapid?: number | null;
          blitz?: number | null;
          birth_year?: number | null;
          sex?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          fide_id?: string;
          period?: string;
          name?: string | null;
          federation?: string | null;
          title?: string | null;
          standard?: number | null;
          rapid?: number | null;
          blitz?: number | null;
          birth_year?: number | null;
          sex?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      game_annotations: {
        Row: {
          id: string;
          game_id: string;
          profile_id: string;
          ply: number;
          comment: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          game_id: string;
          profile_id: string;
          ply?: number;
          comment: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          game_id?: string;
          profile_id?: string;
          ply?: number;
          comment?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "game_annotations_game_id_fkey"; columns: ["game_id"]; isOneToOne: false; referencedRelation: "games"; referencedColumns: ["id"] }, { foreignKeyName: "game_annotations_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      game_positions: {
        Row: {
          game_id: string;
          ply: number;
          fen_key: string;
          next_san: string | null;
        };
        Insert: {
          game_id: string;
          ply: number;
          fen_key: string;
          next_san?: string | null;
        };
        Update: {
          game_id?: string;
          ply?: number;
          fen_key?: string;
          next_san?: string | null;
        };
        Relationships: [{ foreignKeyName: "game_positions_game_id_fkey"; columns: ["game_id"]; isOneToOne: false; referencedRelation: "games"; referencedColumns: ["id"] }];
      };
      games: {
        Row: {
          id: string;
          tournament_id: string | null;
          round_id: string | null;
          pairing_id: string | null;
          round_number: number | null;
          board: number | null;
          white_id: string | null;
          black_id: string | null;
          white_name: string;
          black_name: string;
          white_rating: number | null;
          black_rating: number | null;
          result: string;
          pgn: string;
          eco: string | null;
          opening: string | null;
          moves_count: number | null;
          played_on: string | null;
          cadence: Database["public"]["Enums"]["cadence"] | null;
          source: string;
          is_public: boolean;
          validated_by: string | null;
          validated_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          positions_indexed_at: string | null;
        };
        Insert: {
          id?: string;
          tournament_id?: string | null;
          round_id?: string | null;
          pairing_id?: string | null;
          round_number?: number | null;
          board?: number | null;
          white_id?: string | null;
          black_id?: string | null;
          white_name: string;
          black_name: string;
          white_rating?: number | null;
          black_rating?: number | null;
          result: string;
          pgn: string;
          eco?: string | null;
          opening?: string | null;
          moves_count?: number | null;
          played_on?: string | null;
          cadence?: Database["public"]["Enums"]["cadence"] | null;
          source?: string;
          is_public?: boolean;
          validated_by?: string | null;
          validated_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          positions_indexed_at?: string | null;
        };
        Update: {
          id?: string;
          tournament_id?: string | null;
          round_id?: string | null;
          pairing_id?: string | null;
          round_number?: number | null;
          board?: number | null;
          white_id?: string | null;
          black_id?: string | null;
          white_name?: string;
          black_name?: string;
          white_rating?: number | null;
          black_rating?: number | null;
          result?: string;
          pgn?: string;
          eco?: string | null;
          opening?: string | null;
          moves_count?: number | null;
          played_on?: string | null;
          cadence?: Database["public"]["Enums"]["cadence"] | null;
          source?: string;
          is_public?: boolean;
          validated_by?: string | null;
          validated_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          positions_indexed_at?: string | null;
        };
        Relationships: [{ foreignKeyName: "games_tournament_id_fkey"; columns: ["tournament_id"]; isOneToOne: false; referencedRelation: "tournaments"; referencedColumns: ["id"] }, { foreignKeyName: "games_round_id_fkey"; columns: ["round_id"]; isOneToOne: false; referencedRelation: "rounds"; referencedColumns: ["id"] }, { foreignKeyName: "games_pairing_id_fkey"; columns: ["pairing_id"]; isOneToOne: false; referencedRelation: "pairings"; referencedColumns: ["id"] }, { foreignKeyName: "games_white_id_fkey"; columns: ["white_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }, { foreignKeyName: "games_black_id_fkey"; columns: ["black_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      gift_cards: {
        Row: {
          id: string;
          code: string;
          initial_xof: number;
          balance_xof: number;
          status: string;
          purchase_order_id: string | null;
          recipient_name: string | null;
          recipient_contact: string | null;
          message: string | null;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          initial_xof: number;
          balance_xof: number;
          status?: string;
          purchase_order_id?: string | null;
          recipient_name?: string | null;
          recipient_contact?: string | null;
          message?: string | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          initial_xof?: number;
          balance_xof?: number;
          status?: string;
          purchase_order_id?: string | null;
          recipient_name?: string | null;
          recipient_contact?: string | null;
          message?: string | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "gift_cards_purchase_order_id_fkey"; columns: ["purchase_order_id"]; isOneToOne: false; referencedRelation: "orders"; referencedColumns: ["id"] }];
      };
      glossary_suggestions: {
        Row: {
          id: string;
          term_id: string;
          profile_id: string;
          term_fon: string;
          note: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          term_id: string;
          profile_id: string;
          term_fon: string;
          note?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          term_id?: string;
          profile_id?: string;
          term_fon?: string;
          note?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "glossary_suggestions_term_id_fkey"; columns: ["term_id"]; isOneToOne: false; referencedRelation: "glossary_terms"; referencedColumns: ["id"] }, { foreignKeyName: "glossary_suggestions_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      glossary_terms: {
        Row: {
          id: string;
          term_fr: string;
          term_en: string;
          term_fon: string | null;
          fon_status: string;
          definition: Json;
          category: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          term_fr: string;
          term_en: string;
          term_fon?: string | null;
          fon_status?: string;
          definition?: Json;
          category?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          term_fr?: string;
          term_en?: string;
          term_fon?: string | null;
          fon_status?: string;
          definition?: Json;
          category?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      homework: {
        Row: {
          id: string;
          coach_id: string;
          student_id: string;
          booking_id: string | null;
          title: string;
          details: string | null;
          due_on: string | null;
          done_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          coach_id: string;
          student_id: string;
          booking_id?: string | null;
          title: string;
          details?: string | null;
          due_on?: string | null;
          done_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          coach_id?: string;
          student_id?: string;
          booking_id?: string | null;
          title?: string;
          details?: string | null;
          due_on?: string | null;
          done_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "homework_booking_id_fkey"; columns: ["booking_id"]; isOneToOne: false; referencedRelation: "bookings"; referencedColumns: ["id"] }, { foreignKeyName: "homework_coach_id_fkey"; columns: ["coach_id"]; isOneToOne: false; referencedRelation: "coach_profiles"; referencedColumns: ["id"] }, { foreignKeyName: "homework_student_id_fkey"; columns: ["student_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      invoices: {
        Row: {
          id: string;
          number: string;
          payment_id: string | null;
          profile_id: string | null;
          amount_xof: number;
          lines: Json;
          pdf_path: string | null;
          issued_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          number: string;
          payment_id?: string | null;
          profile_id?: string | null;
          amount_xof: number;
          lines?: Json;
          pdf_path?: string | null;
          issued_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          number?: string;
          payment_id?: string | null;
          profile_id?: string | null;
          amount_xof?: number;
          lines?: Json;
          pdf_path?: string | null;
          issued_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "invoices_payment_id_fkey"; columns: ["payment_id"]; isOneToOne: false; referencedRelation: "payments"; referencedColumns: ["id"] }, { foreignKeyName: "invoices_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      job_posts: {
        Row: {
          id: string;
          organization_id: string | null;
          posted_by: string;
          kind: string;
          title: string;
          description: string;
          city: string | null;
          department: string | null;
          contract: string | null;
          pay_note: string | null;
          contact: string;
          status: string;
          expires_on: string | null;
          is_demo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id?: string | null;
          posted_by: string;
          kind: string;
          title: string;
          description: string;
          city?: string | null;
          department?: string | null;
          contract?: string | null;
          pay_note?: string | null;
          contact: string;
          status?: string;
          expires_on?: string | null;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string | null;
          posted_by?: string;
          kind?: string;
          title?: string;
          description?: string;
          city?: string | null;
          department?: string | null;
          contract?: string | null;
          pay_note?: string | null;
          contact?: string;
          status?: string;
          expires_on?: string | null;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "job_posts_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] }, { foreignKeyName: "job_posts_posted_by_fkey"; columns: ["posted_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      job_runs: {
        Row: {
          id: string;
          job: string;
          status: string;
          details: Json;
          started_at: string;
          finished_at: string | null;
        };
        Insert: {
          id?: string;
          job: string;
          status?: string;
          details?: Json;
          started_at?: string;
          finished_at?: string | null;
        };
        Update: {
          id?: string;
          job?: string;
          status?: string;
          details?: Json;
          started_at?: string;
          finished_at?: string | null;
        };
        Relationships: [];
      };
      league_licenses: {
        Row: {
          id: string;
          season_id: string;
          profile_id: string;
          cadences: Database["public"]["Enums"]["cadence"][];
          status: string;
          amount_xof: number;
          user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          season_id: string;
          profile_id: string;
          cadences?: Database["public"]["Enums"]["cadence"][];
          status?: string;
          amount_xof?: number;
          user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          season_id?: string;
          profile_id?: string;
          cadences?: Database["public"]["Enums"]["cadence"][];
          status?: string;
          amount_xof?: number;
          user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "league_licenses_season_id_fkey"; columns: ["season_id"]; isOneToOne: false; referencedRelation: "seasons"; referencedColumns: ["id"] }, { foreignKeyName: "league_licenses_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      league_matchdays: {
        Row: {
          id: string;
          league_id: string;
          number: number;
          scheduled_on: string | null;
          rounds: string | null;
          tournament_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          league_id: string;
          number: number;
          scheduled_on?: string | null;
          rounds?: string | null;
          tournament_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          league_id?: string;
          number?: number;
          scheduled_on?: string | null;
          rounds?: string | null;
          tournament_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "league_matchdays_league_id_fkey"; columns: ["league_id"]; isOneToOne: false; referencedRelation: "leagues"; referencedColumns: ["id"] }, { foreignKeyName: "league_matchdays_tournament_id_fkey"; columns: ["tournament_id"]; isOneToOne: false; referencedRelation: "tournaments"; referencedColumns: ["id"] }];
      };
      league_members: {
        Row: {
          id: string;
          league_id: string;
          profile_id: string;
          seed: number | null;
          status: string;
          unjustified_forfeits: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          league_id: string;
          profile_id: string;
          seed?: number | null;
          status?: string;
          unjustified_forfeits?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          league_id?: string;
          profile_id?: string;
          seed?: number | null;
          status?: string;
          unjustified_forfeits?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "league_members_league_id_fkey"; columns: ["league_id"]; isOneToOne: false; referencedRelation: "leagues"; referencedColumns: ["id"] }, { foreignKeyName: "league_members_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      league_postponements: {
        Row: {
          id: string;
          pairing_id: string;
          requested_by: string;
          reason: string | null;
          proposed_date: string | null;
          opponent_agreed: boolean;
          status: string;
          decided_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          pairing_id: string;
          requested_by: string;
          reason?: string | null;
          proposed_date?: string | null;
          opponent_agreed?: boolean;
          status?: string;
          decided_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          pairing_id?: string;
          requested_by?: string;
          reason?: string | null;
          proposed_date?: string | null;
          opponent_agreed?: boolean;
          status?: string;
          decided_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "league_postponements_pairing_id_fkey"; columns: ["pairing_id"]; isOneToOne: true; referencedRelation: "pairings"; referencedColumns: ["id"] }, { foreignKeyName: "league_postponements_requested_by_fkey"; columns: ["requested_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      leagues: {
        Row: {
          id: string;
          season_id: string;
          slug: string;
          division: string;
          cadence: Database["public"]["Enums"]["cadence"];
          format: string;
          size: number | null;
          base_minutes: number;
          increment_seconds: number;
          rounds_count: number | null;
          schedule_note: Json;
          status: string;
          champion_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          season_id: string;
          slug: string;
          division: string;
          cadence: Database["public"]["Enums"]["cadence"];
          format: string;
          size?: number | null;
          base_minutes: number;
          increment_seconds: number;
          rounds_count?: number | null;
          schedule_note?: Json;
          status?: string;
          champion_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          season_id?: string;
          slug?: string;
          division?: string;
          cadence?: Database["public"]["Enums"]["cadence"];
          format?: string;
          size?: number | null;
          base_minutes?: number;
          increment_seconds?: number;
          rounds_count?: number | null;
          schedule_note?: Json;
          status?: string;
          champion_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "leagues_season_id_fkey"; columns: ["season_id"]; isOneToOne: false; referencedRelation: "seasons"; referencedColumns: ["id"] }, { foreignKeyName: "leagues_champion_id_fkey"; columns: ["champion_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      lessons_library: {
        Row: {
          id: string;
          slug: string;
          level: string;
          theme: string;
          title: Json;
          summary: Json;
          body: Json;
          positions: Json;
          position: number;
          is_premium: boolean;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          level: string;
          theme: string;
          title: Json;
          summary?: Json;
          body?: Json;
          positions?: Json;
          position?: number;
          is_premium?: boolean;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          level?: string;
          theme?: string;
          title?: Json;
          summary?: Json;
          body?: Json;
          positions?: Json;
          position?: number;
          is_premium?: boolean;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      lichess_accounts: {
        Row: {
          profile_id: string;
          username: string;
          lichess_id: string;
          linked_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          profile_id: string;
          username: string;
          lichess_id: string;
          linked_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          profile_id?: string;
          username?: string;
          lichess_id?: string;
          linked_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "lichess_accounts_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: true; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      listing_claims: {
        Row: {
          id: string;
          organization_id: string;
          profile_id: string;
          role_in_org: string;
          message: string | null;
          status: string;
          decided_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          profile_id: string;
          role_in_org: string;
          message?: string | null;
          status?: string;
          decided_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          profile_id?: string;
          role_in_org?: string;
          message?: string | null;
          status?: string;
          decided_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "listing_claims_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] }, { foreignKeyName: "listing_claims_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      loyalty_ledger: {
        Row: {
          id: string;
          profile_id: string;
          points: number;
          reason: string;
          order_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          points: number;
          reason: string;
          order_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          points?: number;
          reason?: string;
          order_id?: string | null;
          created_at?: string;
        };
        Relationships: [{ foreignKeyName: "loyalty_ledger_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }, { foreignKeyName: "loyalty_ledger_order_id_fkey"; columns: ["order_id"]; isOneToOne: false; referencedRelation: "orders"; referencedColumns: ["id"] }];
      };
      masters_invitations: {
        Row: {
          season_id: string;
          profile_id: string;
          created_at: string;
        };
        Insert: {
          season_id: string;
          profile_id: string;
          created_at?: string;
        };
        Update: {
          season_id?: string;
          profile_id?: string;
          created_at?: string;
        };
        Relationships: [{ foreignKeyName: "masters_invitations_season_id_fkey"; columns: ["season_id"]; isOneToOne: false; referencedRelation: "seasons"; referencedColumns: ["id"] }, { foreignKeyName: "masters_invitations_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      media_episodes: {
        Row: {
          id: string;
          series_id: string;
          slug: string;
          season: number;
          number: number;
          title: Json;
          description: Json;
          format: string;
          video_url: string | null;
          audio_url: string | null;
          live_at: string | null;
          duration_min: number | null;
          language: string;
          level: string | null;
          theme: string | null;
          transcript: string | null;
          positions: Json;
          status: string;
          published_at: string | null;
          is_demo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          series_id: string;
          slug: string;
          season?: number;
          number: number;
          title: Json;
          description?: Json;
          format: string;
          video_url?: string | null;
          audio_url?: string | null;
          live_at?: string | null;
          duration_min?: number | null;
          language?: string;
          level?: string | null;
          theme?: string | null;
          transcript?: string | null;
          positions?: Json;
          status?: string;
          published_at?: string | null;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          series_id?: string;
          slug?: string;
          season?: number;
          number?: number;
          title?: Json;
          description?: Json;
          format?: string;
          video_url?: string | null;
          audio_url?: string | null;
          live_at?: string | null;
          duration_min?: number | null;
          language?: string;
          level?: string | null;
          theme?: string | null;
          transcript?: string | null;
          positions?: Json;
          status?: string;
          published_at?: string | null;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "media_episodes_series_id_fkey"; columns: ["series_id"]; isOneToOne: false; referencedRelation: "media_series"; referencedColumns: ["id"] }];
      };
      media_series: {
        Row: {
          id: string;
          slug: string;
          kind: string;
          title: Json;
          description: Json;
          language: string;
          position: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          kind: string;
          title: Json;
          description?: Json;
          language?: string;
          position?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          kind?: string;
          title?: Json;
          description?: Json;
          language?: string;
          position?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      membership_plans: {
        Row: {
          code: string;
          name: Json;
          description: Json;
          benefits: Json;
          price_xof: number | null;
          duration_months: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          name: Json;
          description?: Json;
          benefits?: Json;
          price_xof?: number | null;
          duration_months?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          name?: Json;
          description?: Json;
          benefits?: Json;
          price_xof?: number | null;
          duration_months?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      memberships: {
        Row: {
          id: string;
          profile_id: string;
          plan: string;
          status: string;
          card_number: string;
          amount_xof: number;
          starts_on: string | null;
          ends_on: string | null;
          user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          plan: string;
          status?: string;
          card_number?: string;
          amount_xof?: number;
          starts_on?: string | null;
          ends_on?: string | null;
          user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          plan?: string;
          status?: string;
          card_number?: string;
          amount_xof?: number;
          starts_on?: string | null;
          ends_on?: string | null;
          user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "memberships_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }, { foreignKeyName: "memberships_plan_fkey"; columns: ["plan"]; isOneToOne: false; referencedRelation: "membership_plans"; referencedColumns: ["code"] }];
      };
      newsletter_subscribers: {
        Row: {
          id: string;
          email: string;
          locale: string;
          consented_at: string;
          unsubscribed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          locale?: string;
          consented_at?: string;
          unsubscribed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          locale?: string;
          consented_at?: string;
          unsubscribed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          profile_id: string | null;
          channel: string;
          template: string;
          recipient: string | null;
          payload: Json;
          status: string;
          provider: string | null;
          provider_ref: string | null;
          error: string | null;
          read_at: string | null;
          sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id?: string | null;
          channel: string;
          template: string;
          recipient?: string | null;
          payload?: Json;
          status?: string;
          provider?: string | null;
          provider_ref?: string | null;
          error?: string | null;
          read_at?: string | null;
          sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string | null;
          channel?: string;
          template?: string;
          recipient?: string | null;
          payload?: Json;
          status?: string;
          provider?: string | null;
          provider_ref?: string | null;
          error?: string | null;
          read_at?: string | null;
          sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "notifications_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      offers: {
        Row: {
          id: string;
          coach_id: string;
          title: Json;
          description: Json;
          language: string;
          modality: string;
          level: string;
          format: string;
          duration_min: number;
          price_xof: number;
          capacity: number;
          pack_sessions: number | null;
          pack_price_xof: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          coach_id: string;
          title: Json;
          description?: Json;
          language: string;
          modality: string;
          level: string;
          format: string;
          duration_min?: number;
          price_xof: number;
          capacity?: number;
          pack_sessions?: number | null;
          pack_price_xof?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          coach_id?: string;
          title?: Json;
          description?: Json;
          language?: string;
          modality?: string;
          level?: string;
          format?: string;
          duration_min?: number;
          price_xof?: number;
          capacity?: number;
          pack_sessions?: number | null;
          pack_price_xof?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "offers_coach_id_fkey"; columns: ["coach_id"]; isOneToOne: false; referencedRelation: "coach_profiles"; referencedColumns: ["id"] }];
      };
      order_events: {
        Row: {
          id: string;
          order_id: string;
          status: Database["public"]["Enums"]["order_status"];
          note: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          status: Database["public"]["Enums"]["order_status"];
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          status?: Database["public"]["Enums"]["order_status"];
          note?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [{ foreignKeyName: "order_events_order_id_fkey"; columns: ["order_id"]; isOneToOne: false; referencedRelation: "orders"; referencedColumns: ["id"] }];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          product_id: string | null;
          variant_id: string | null;
          name: string;
          variant_name: string | null;
          unit_price_xof: number;
          quantity: number;
          total_xof: number;
          is_preorder: boolean;
          gift: Json | null;
        };
        Insert: {
          id?: string;
          order_id: string;
          product_id?: string | null;
          variant_id?: string | null;
          name: string;
          variant_name?: string | null;
          unit_price_xof: number;
          quantity: number;
          total_xof: number;
          is_preorder?: boolean;
          gift?: Json | null;
        };
        Update: {
          id?: string;
          order_id?: string;
          product_id?: string | null;
          variant_id?: string | null;
          name?: string;
          variant_name?: string | null;
          unit_price_xof?: number;
          quantity?: number;
          total_xof?: number;
          is_preorder?: boolean;
          gift?: Json | null;
        };
        Relationships: [{ foreignKeyName: "order_items_order_id_fkey"; columns: ["order_id"]; isOneToOne: false; referencedRelation: "orders"; referencedColumns: ["id"] }, { foreignKeyName: "order_items_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] }, { foreignKeyName: "order_items_variant_id_fkey"; columns: ["variant_id"]; isOneToOne: false; referencedRelation: "product_variants"; referencedColumns: ["id"] }];
      };
      orders: {
        Row: {
          id: string;
          number: string;
          user_id: string | null;
          profile_id: string | null;
          status: Database["public"]["Enums"]["order_status"];
          delivery_method: string;
          delivery_address: Json;
          contact_name: string;
          contact_phone: string;
          contact_email: string | null;
          subtotal_xof: number;
          discount_xof: number;
          shipping_xof: number;
          gift_card_xof: number;
          loyalty_xof: number;
          total_xof: number;
          promo_code_id: string | null;
          gift_card_id: string | null;
          loyalty_points_used: number;
          loyalty_points_earned: number;
          has_preorder: boolean;
          notes: string | null;
          tracking_note: string | null;
          paid_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          number?: string;
          user_id?: string | null;
          profile_id?: string | null;
          status?: Database["public"]["Enums"]["order_status"];
          delivery_method: string;
          delivery_address?: Json;
          contact_name: string;
          contact_phone: string;
          contact_email?: string | null;
          subtotal_xof: number;
          discount_xof?: number;
          shipping_xof?: number;
          gift_card_xof?: number;
          loyalty_xof?: number;
          total_xof: number;
          promo_code_id?: string | null;
          gift_card_id?: string | null;
          loyalty_points_used?: number;
          loyalty_points_earned?: number;
          has_preorder?: boolean;
          notes?: string | null;
          tracking_note?: string | null;
          paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          number?: string;
          user_id?: string | null;
          profile_id?: string | null;
          status?: Database["public"]["Enums"]["order_status"];
          delivery_method?: string;
          delivery_address?: Json;
          contact_name?: string;
          contact_phone?: string;
          contact_email?: string | null;
          subtotal_xof?: number;
          discount_xof?: number;
          shipping_xof?: number;
          gift_card_xof?: number;
          loyalty_xof?: number;
          total_xof?: number;
          promo_code_id?: string | null;
          gift_card_id?: string | null;
          loyalty_points_used?: number;
          loyalty_points_earned?: number;
          has_preorder?: boolean;
          notes?: string | null;
          tracking_note?: string | null;
          paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "orders_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }, { foreignKeyName: "orders_promo_code_id_fkey"; columns: ["promo_code_id"]; isOneToOne: false; referencedRelation: "promo_codes"; referencedColumns: ["id"] }, { foreignKeyName: "orders_gift_card_fk"; columns: ["gift_card_id"]; isOneToOne: false; referencedRelation: "gift_cards"; referencedColumns: ["id"] }];
      };
      organization_members: {
        Row: {
          id: string;
          organization_id: string;
          profile_id: string;
          role: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          profile_id: string;
          role?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          profile_id?: string;
          role?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "organization_members_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] }, { foreignKeyName: "organization_members_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      organizations: {
        Row: {
          id: string;
          type: Database["public"]["Enums"]["org_type"];
          name: string;
          slug: string;
          description: string | null;
          country: string;
          department: string | null;
          city: string | null;
          address: string | null;
          lat: number | null;
          lng: number | null;
          phone: string | null;
          email: string | null;
          website: string | null;
          logo_path: string | null;
          languages: string[];
          is_public: boolean;
          verified: boolean;
          claimed_by: string | null;
          is_demo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          type: Database["public"]["Enums"]["org_type"];
          name: string;
          slug: string;
          description?: string | null;
          country?: string;
          department?: string | null;
          city?: string | null;
          address?: string | null;
          lat?: number | null;
          lng?: number | null;
          phone?: string | null;
          email?: string | null;
          website?: string | null;
          logo_path?: string | null;
          languages?: string[];
          is_public?: boolean;
          verified?: boolean;
          claimed_by?: string | null;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          type?: Database["public"]["Enums"]["org_type"];
          name?: string;
          slug?: string;
          description?: string | null;
          country?: string;
          department?: string | null;
          city?: string | null;
          address?: string | null;
          lat?: number | null;
          lng?: number | null;
          phone?: string | null;
          email?: string | null;
          website?: string | null;
          logo_path?: string | null;
          languages?: string[];
          is_public?: boolean;
          verified?: boolean;
          claimed_by?: string | null;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "organizations_claimed_by_fkey"; columns: ["claimed_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }, { foreignKeyName: "organizations_country_fk"; columns: ["country"]; isOneToOne: false; referencedRelation: "countries"; referencedColumns: ["code"] }];
      };
      pairings: {
        Row: {
          id: string;
          tournament_id: string;
          round_id: string;
          board: number;
          white_id: string;
          black_id: string | null;
          result: Database["public"]["Enums"]["game_result"] | null;
          bye_type: string | null;
          is_manual: boolean;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
          stage: string;
          result_entered_by: string | null;
          result_entered_at: string | null;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          round_id: string;
          board: number;
          white_id: string;
          black_id?: string | null;
          result?: Database["public"]["Enums"]["game_result"] | null;
          bye_type?: string | null;
          is_manual?: boolean;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
          stage?: string;
          result_entered_by?: string | null;
          result_entered_at?: string | null;
        };
        Update: {
          id?: string;
          tournament_id?: string;
          round_id?: string;
          board?: number;
          white_id?: string;
          black_id?: string | null;
          result?: Database["public"]["Enums"]["game_result"] | null;
          bye_type?: string | null;
          is_manual?: boolean;
          updated_by?: string | null;
          created_at?: string;
          updated_at?: string;
          stage?: string;
          result_entered_by?: string | null;
          result_entered_at?: string | null;
        };
        Relationships: [{ foreignKeyName: "pairings_tournament_id_fkey"; columns: ["tournament_id"]; isOneToOne: false; referencedRelation: "tournaments"; referencedColumns: ["id"] }, { foreignKeyName: "pairings_round_id_fkey"; columns: ["round_id"]; isOneToOne: false; referencedRelation: "rounds"; referencedColumns: ["id"] }, { foreignKeyName: "pairings_white_id_fkey"; columns: ["white_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }, { foreignKeyName: "pairings_black_id_fkey"; columns: ["black_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      payment_webhooks: {
        Row: {
          id: string;
          provider: string;
          event_type: string | null;
          signature_valid: boolean;
          payment_id: string | null;
          payload: Json;
          processed_at: string | null;
          error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider: string;
          event_type?: string | null;
          signature_valid: boolean;
          payment_id?: string | null;
          payload: Json;
          processed_at?: string | null;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          provider?: string;
          event_type?: string | null;
          signature_valid?: boolean;
          payment_id?: string | null;
          payload?: Json;
          processed_at?: string | null;
          error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "payment_webhooks_payment_id_fkey"; columns: ["payment_id"]; isOneToOne: false; referencedRelation: "payments"; referencedColumns: ["id"] }];
      };
      payments: {
        Row: {
          id: string;
          provider: string;
          amount_xof: number;
          currency: string;
          status: string;
          provider_ref: string | null;
          checkout_url: string | null;
          object_type: string;
          object_id: string;
          payer_profile_id: string | null;
          user_id: string | null;
          description: string | null;
          confirmed_at: string | null;
          failure_reason: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider: string;
          amount_xof: number;
          currency?: string;
          status?: string;
          provider_ref?: string | null;
          checkout_url?: string | null;
          object_type: string;
          object_id: string;
          payer_profile_id?: string | null;
          user_id?: string | null;
          description?: string | null;
          confirmed_at?: string | null;
          failure_reason?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          provider?: string;
          amount_xof?: number;
          currency?: string;
          status?: string;
          provider_ref?: string | null;
          checkout_url?: string | null;
          object_type?: string;
          object_id?: string;
          payer_profile_id?: string | null;
          user_id?: string | null;
          description?: string | null;
          confirmed_at?: string | null;
          failure_reason?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "payments_payer_profile_id_fkey"; columns: ["payer_profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      payouts: {
        Row: {
          id: string;
          coach_id: string;
          period_start: string;
          period_end: string;
          gross_xof: number;
          commission_xof: number;
          net_xof: number;
          status: string;
          paid_at: string | null;
          reference: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          coach_id: string;
          period_start: string;
          period_end: string;
          gross_xof: number;
          commission_xof: number;
          net_xof: number;
          status?: string;
          paid_at?: string | null;
          reference?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          coach_id?: string;
          period_start?: string;
          period_end?: string;
          gross_xof?: number;
          commission_xof?: number;
          net_xof?: number;
          status?: string;
          paid_at?: string | null;
          reference?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "payouts_coach_id_fkey"; columns: ["coach_id"]; isOneToOne: false; referencedRelation: "coach_profiles"; referencedColumns: ["id"] }];
      };
      placement_results: {
        Row: {
          id: string;
          profile_id: string | null;
          score: number;
          total: number;
          level: string;
          answers: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id?: string | null;
          score: number;
          total: number;
          level: string;
          answers?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string | null;
          score?: number;
          total?: number;
          level?: string;
          answers?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "placement_results_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      posters: {
        Row: {
          id: string;
          tournament_id: string;
          format: string;
          path: string | null;
          template: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          format: string;
          path?: string | null;
          template?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tournament_id?: string;
          format?: string;
          path?: string | null;
          template?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "posters_tournament_id_fkey"; columns: ["tournament_id"]; isOneToOne: false; referencedRelation: "tournaments"; referencedColumns: ["id"] }];
      };
      predictions: {
        Row: {
          id: string;
          profile_id: string;
          pairing_id: string;
          predicted: string;
          points: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          pairing_id: string;
          predicted: string;
          points?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          pairing_id?: string;
          predicted?: string;
          points?: number;
          created_at?: string;
        };
        Relationships: [{ foreignKeyName: "predictions_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }, { foreignKeyName: "predictions_pairing_id_fkey"; columns: ["pairing_id"]; isOneToOne: false; referencedRelation: "pairings"; referencedColumns: ["id"] }];
      };
      prizes: {
        Row: {
          id: string;
          tournament_id: string;
          kind: string;
          rank: number | null;
          category: string | null;
          label: Json;
          amount_xof: number | null;
          awarded_profile_id: string | null;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          kind?: string;
          rank?: number | null;
          category?: string | null;
          label?: Json;
          amount_xof?: number | null;
          awarded_profile_id?: string | null;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tournament_id?: string;
          kind?: string;
          rank?: number | null;
          category?: string | null;
          label?: Json;
          amount_xof?: number | null;
          awarded_profile_id?: string | null;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "prizes_tournament_id_fkey"; columns: ["tournament_id"]; isOneToOne: false; referencedRelation: "tournaments"; referencedColumns: ["id"] }, { foreignKeyName: "prizes_awarded_profile_id_fkey"; columns: ["awarded_profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      product_categories: {
        Row: {
          id: string;
          slug: string;
          name: Json;
          description: Json;
          position: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: Json;
          description?: Json;
          position?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: Json;
          description?: Json;
          position?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      product_reviews: {
        Row: {
          id: string;
          product_id: string;
          profile_id: string;
          rating: number;
          body: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          profile_id: string;
          rating: number;
          body?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          profile_id?: string;
          rating?: number;
          body?: string | null;
          status?: string;
          created_at?: string;
        };
        Relationships: [{ foreignKeyName: "product_reviews_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] }, { foreignKeyName: "product_reviews_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      product_variants: {
        Row: {
          id: string;
          product_id: string;
          name: Json;
          sku: string | null;
          price_xof: number | null;
          stock: number;
          position: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          name?: Json;
          sku?: string | null;
          price_xof?: number | null;
          stock?: number;
          position?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          name?: Json;
          sku?: string | null;
          price_xof?: number | null;
          stock?: number;
          position?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "product_variants_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] }];
      };
      products: {
        Row: {
          id: string;
          category_id: string | null;
          slug: string;
          kind: string;
          name: Json;
          description: Json;
          price_xof: number;
          compare_at_xof: number | null;
          art: string;
          image_url: string | null;
          is_active: boolean;
          is_featured: boolean;
          is_preorder: boolean;
          preorder_date: string | null;
          rating_avg: number | null;
          reviews_count: number;
          is_demo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id?: string | null;
          slug: string;
          kind?: string;
          name: Json;
          description?: Json;
          price_xof: number;
          compare_at_xof?: number | null;
          art?: string;
          image_url?: string | null;
          is_active?: boolean;
          is_featured?: boolean;
          is_preorder?: boolean;
          preorder_date?: string | null;
          rating_avg?: number | null;
          reviews_count?: number;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string | null;
          slug?: string;
          kind?: string;
          name?: Json;
          description?: Json;
          price_xof?: number;
          compare_at_xof?: number | null;
          art?: string;
          image_url?: string | null;
          is_active?: boolean;
          is_featured?: boolean;
          is_preorder?: boolean;
          preorder_date?: string | null;
          rating_avg?: number | null;
          reviews_count?: number;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "products_category_id_fkey"; columns: ["category_id"]; isOneToOne: false; referencedRelation: "product_categories"; referencedColumns: ["id"] }];
      };
      profiles: {
        Row: {
          id: string;
          user_id: string | null;
          first_name: string;
          last_name: string;
          birth_date: string | null;
          sex: Database["public"]["Enums"]["sex"] | null;
          phone: string | null;
          email: string | null;
          photo_path: string | null;
          country: string;
          department: string | null;
          city: string | null;
          club_id: string | null;
          club_name: string | null;
          fide_id: string | null;
          titles: string[];
          languages: string[];
          bio: string | null;
          is_public: boolean;
          is_minor: boolean;
          guardian_id: string | null;
          claimed: boolean;
          verified: boolean;
          onboarded: boolean;
          source: string;
          merged_into: string | null;
          suspended_at: string | null;
          preferred_locale: string;
          notification_prefs: Json;
          is_demo: boolean;
          search_text: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          first_name: string;
          last_name: string;
          birth_date?: string | null;
          sex?: Database["public"]["Enums"]["sex"] | null;
          phone?: string | null;
          email?: string | null;
          photo_path?: string | null;
          country?: string;
          department?: string | null;
          city?: string | null;
          club_id?: string | null;
          club_name?: string | null;
          fide_id?: string | null;
          titles?: string[];
          languages?: string[];
          bio?: string | null;
          is_public?: boolean;
          is_minor?: boolean;
          guardian_id?: string | null;
          claimed?: boolean;
          verified?: boolean;
          onboarded?: boolean;
          source?: string;
          merged_into?: string | null;
          suspended_at?: string | null;
          preferred_locale?: string;
          notification_prefs?: Json;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          first_name?: string;
          last_name?: string;
          birth_date?: string | null;
          sex?: Database["public"]["Enums"]["sex"] | null;
          phone?: string | null;
          email?: string | null;
          photo_path?: string | null;
          country?: string;
          department?: string | null;
          city?: string | null;
          club_id?: string | null;
          club_name?: string | null;
          fide_id?: string | null;
          titles?: string[];
          languages?: string[];
          bio?: string | null;
          is_public?: boolean;
          is_minor?: boolean;
          guardian_id?: string | null;
          claimed?: boolean;
          verified?: boolean;
          onboarded?: boolean;
          source?: string;
          merged_into?: string | null;
          suspended_at?: string | null;
          preferred_locale?: string;
          notification_prefs?: Json;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "profiles_guardian_id_fkey"; columns: ["guardian_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }, { foreignKeyName: "profiles_merged_into_fkey"; columns: ["merged_into"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }, { foreignKeyName: "profiles_club_fk"; columns: ["club_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] }, { foreignKeyName: "profiles_country_fk"; columns: ["country"]; isOneToOne: false; referencedRelation: "countries"; referencedColumns: ["code"] }];
      };
      progress_notes: {
        Row: {
          id: string;
          coach_id: string;
          student_id: string;
          booking_id: string | null;
          note: string;
          level: string | null;
          replay_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          coach_id: string;
          student_id: string;
          booking_id?: string | null;
          note: string;
          level?: string | null;
          replay_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          coach_id?: string;
          student_id?: string;
          booking_id?: string | null;
          note?: string;
          level?: string | null;
          replay_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "progress_notes_coach_id_fkey"; columns: ["coach_id"]; isOneToOne: false; referencedRelation: "coach_profiles"; referencedColumns: ["id"] }, { foreignKeyName: "progress_notes_student_id_fkey"; columns: ["student_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }, { foreignKeyName: "progress_notes_booking_id_fkey"; columns: ["booking_id"]; isOneToOne: false; referencedRelation: "bookings"; referencedColumns: ["id"] }];
      };
      promo_codes: {
        Row: {
          id: string;
          code: string;
          kind: string;
          value: number;
          min_subtotal_xof: number;
          starts_at: string | null;
          ends_at: string | null;
          max_uses: number | null;
          uses: number;
          is_active: boolean;
          is_demo: boolean;
          created_at: string;
          max_uses_per_user: number | null;
        };
        Insert: {
          id?: string;
          code: string;
          kind: string;
          value?: number;
          min_subtotal_xof?: number;
          starts_at?: string | null;
          ends_at?: string | null;
          max_uses?: number | null;
          uses?: number;
          is_active?: boolean;
          is_demo?: boolean;
          created_at?: string;
          max_uses_per_user?: number | null;
        };
        Update: {
          id?: string;
          code?: string;
          kind?: string;
          value?: number;
          min_subtotal_xof?: number;
          starts_at?: string | null;
          ends_at?: string | null;
          max_uses?: number | null;
          uses?: number;
          is_active?: boolean;
          is_demo?: boolean;
          created_at?: string;
          max_uses_per_user?: number | null;
        };
        Relationships: [];
      };
      push_tokens: {
        Row: {
          token: string;
          profile_id: string;
          platform: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          token: string;
          profile_id: string;
          platform: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          token?: string;
          profile_id?: string;
          platform?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "push_tokens_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      puzzle_attempts: {
        Row: {
          id: string;
          puzzle_id: string;
          profile_id: string;
          solved: boolean;
          context: string;
          attempted_on: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          puzzle_id: string;
          profile_id: string;
          solved: boolean;
          context?: string;
          attempted_on?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          puzzle_id?: string;
          profile_id?: string;
          solved?: boolean;
          context?: string;
          attempted_on?: string;
          created_at?: string;
        };
        Relationships: [{ foreignKeyName: "puzzle_attempts_puzzle_id_fkey"; columns: ["puzzle_id"]; isOneToOne: false; referencedRelation: "puzzles"; referencedColumns: ["id"] }, { foreignKeyName: "puzzle_attempts_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      puzzles: {
        Row: {
          id: string;
          code: string;
          fen: string;
          solution: string[];
          theme: string;
          mate_in: number | null;
          rating: number | null;
          source: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          fen: string;
          solution: string[];
          theme: string;
          mate_in?: number | null;
          rating?: number | null;
          source?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          fen?: string;
          solution?: string[];
          theme?: string;
          mate_in?: number | null;
          rating?: number | null;
          source?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pvm_games: {
        Row: {
          id: string;
          slug: string;
          title: Json;
          master_name: string;
          master_profile_id: string | null;
          public_color: string;
          fen: string;
          moves: string[];
          status: string;
          result: string | null;
          vote_minutes: number;
          vote_ends_at: string | null;
          is_demo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          title: Json;
          master_name: string;
          master_profile_id?: string | null;
          public_color?: string;
          fen?: string;
          moves?: string[];
          status?: string;
          result?: string | null;
          vote_minutes?: number;
          vote_ends_at?: string | null;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          title?: Json;
          master_name?: string;
          master_profile_id?: string | null;
          public_color?: string;
          fen?: string;
          moves?: string[];
          status?: string;
          result?: string | null;
          vote_minutes?: number;
          vote_ends_at?: string | null;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "pvm_games_master_profile_id_fkey"; columns: ["master_profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      pvm_votes: {
        Row: {
          game_id: string;
          ply: number;
          profile_id: string;
          move: string;
          created_at: string;
        };
        Insert: {
          game_id: string;
          ply: number;
          profile_id: string;
          move: string;
          created_at?: string;
        };
        Update: {
          game_id?: string;
          ply?: number;
          profile_id?: string;
          move?: string;
          created_at?: string;
        };
        Relationships: [{ foreignKeyName: "pvm_votes_game_id_fkey"; columns: ["game_id"]; isOneToOne: false; referencedRelation: "pvm_games"; referencedColumns: ["id"] }, { foreignKeyName: "pvm_votes_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      quote_requests: {
        Row: {
          id: string;
          kind: string;
          organization: string;
          contact_name: string;
          phone: string | null;
          email: string | null;
          city: string | null;
          participants: number | null;
          message: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          kind: string;
          organization: string;
          contact_name: string;
          phone?: string | null;
          email?: string | null;
          city?: string | null;
          participants?: number | null;
          message?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          kind?: string;
          organization?: string;
          contact_name?: string;
          phone?: string | null;
          email?: string | null;
          city?: string | null;
          participants?: number | null;
          message?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rating_history: {
        Row: {
          id: string;
          profile_id: string;
          type: Database["public"]["Enums"]["rating_type"];
          tournament_id: string | null;
          game_id: string | null;
          rating_before: number;
          rating_after: number;
          delta: number | null;
          games: number;
          effective_on: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          type: Database["public"]["Enums"]["rating_type"];
          tournament_id?: string | null;
          game_id?: string | null;
          rating_before: number;
          rating_after: number;
          games?: number;
          effective_on: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          type?: Database["public"]["Enums"]["rating_type"];
          tournament_id?: string | null;
          game_id?: string | null;
          rating_before?: number;
          rating_after?: number;
          games?: number;
          effective_on?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "rating_history_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }, { foreignKeyName: "rating_history_tournament_id_fkey"; columns: ["tournament_id"]; isOneToOne: false; referencedRelation: "tournaments"; referencedColumns: ["id"] }, { foreignKeyName: "rating_history_game_id_fkey"; columns: ["game_id"]; isOneToOne: false; referencedRelation: "games"; referencedColumns: ["id"] }];
      };
      rating_lists: {
        Row: {
          id: string;
          period: string;
          type: Database["public"]["Enums"]["rating_type"];
          published_at: string | null;
          entries: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          period: string;
          type: Database["public"]["Enums"]["rating_type"];
          published_at?: string | null;
          entries?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          period?: string;
          type?: Database["public"]["Enums"]["rating_type"];
          published_at?: string | null;
          entries?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ratings: {
        Row: {
          id: string;
          profile_id: string;
          type: Database["public"]["Enums"]["rating_type"];
          rating: number;
          games: number;
          provisional: boolean;
          peak: number | null;
          last_game_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          type: Database["public"]["Enums"]["rating_type"];
          rating: number;
          games?: number;
          provisional?: boolean;
          peak?: number | null;
          last_game_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          type?: Database["public"]["Enums"]["rating_type"];
          rating?: number;
          games?: number;
          provisional?: boolean;
          peak?: number | null;
          last_game_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "ratings_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      referral_codes: {
        Row: {
          profile_id: string;
          code: string;
          created_at: string;
        };
        Insert: {
          profile_id: string;
          code: string;
          created_at?: string;
        };
        Update: {
          profile_id?: string;
          code?: string;
          created_at?: string;
        };
        Relationships: [{ foreignKeyName: "referral_codes_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: true; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      referrals: {
        Row: {
          id: string;
          referrer_id: string;
          referred_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          referrer_id: string;
          referred_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          referrer_id?: string;
          referred_id?: string;
          created_at?: string;
        };
        Relationships: [{ foreignKeyName: "referrals_referrer_id_fkey"; columns: ["referrer_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }, { foreignKeyName: "referrals_referred_id_fkey"; columns: ["referred_id"]; isOneToOne: true; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      refunds: {
        Row: {
          id: string;
          payment_id: string;
          amount_xof: number;
          reason: string | null;
          status: string;
          requested_by: string | null;
          provider_ref: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          payment_id: string;
          amount_xof: number;
          reason?: string | null;
          status?: string;
          requested_by?: string | null;
          provider_ref?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          payment_id?: string;
          amount_xof?: number;
          reason?: string | null;
          status?: string;
          requested_by?: string | null;
          provider_ref?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "refunds_payment_id_fkey"; columns: ["payment_id"]; isOneToOne: false; referencedRelation: "payments"; referencedColumns: ["id"] }];
      };
      registration_forms: {
        Row: {
          id: string;
          tournament_id: string;
          fields: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          fields?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tournament_id?: string;
          fields?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "registration_forms_tournament_id_fkey"; columns: ["tournament_id"]; isOneToOne: true; referencedRelation: "tournaments"; referencedColumns: ["id"] }];
      };
      registrations: {
        Row: {
          id: string;
          tournament_id: string;
          player_id: string;
          registered_by: string | null;
          status: Database["public"]["Enums"]["registration_status"];
          payment_status: Database["public"]["Enums"]["payment_status"];
          payment_method: string;
          amount_xof: number | null;
          answers: Json;
          ticket_code: string;
          seed_rating: number | null;
          category: string | null;
          waitlist_position: number | null;
          checked_in_at: string | null;
          checked_in_by: string | null;
          notes: string | null;
          source: string;
          created_at: string;
          updated_at: string;
          start_number: number | null;
          withdrawn_at: string | null;
          bye_requests: Json;
          reminder_sent_at: string | null;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          player_id: string;
          registered_by?: string | null;
          status: Database["public"]["Enums"]["registration_status"];
          payment_status?: Database["public"]["Enums"]["payment_status"];
          payment_method?: string;
          amount_xof?: number | null;
          answers?: Json;
          ticket_code?: string;
          seed_rating?: number | null;
          category?: string | null;
          waitlist_position?: number | null;
          checked_in_at?: string | null;
          checked_in_by?: string | null;
          notes?: string | null;
          source?: string;
          created_at?: string;
          updated_at?: string;
          start_number?: number | null;
          withdrawn_at?: string | null;
          bye_requests?: Json;
          reminder_sent_at?: string | null;
        };
        Update: {
          id?: string;
          tournament_id?: string;
          player_id?: string;
          registered_by?: string | null;
          status?: Database["public"]["Enums"]["registration_status"];
          payment_status?: Database["public"]["Enums"]["payment_status"];
          payment_method?: string;
          amount_xof?: number | null;
          answers?: Json;
          ticket_code?: string;
          seed_rating?: number | null;
          category?: string | null;
          waitlist_position?: number | null;
          checked_in_at?: string | null;
          checked_in_by?: string | null;
          notes?: string | null;
          source?: string;
          created_at?: string;
          updated_at?: string;
          start_number?: number | null;
          withdrawn_at?: string | null;
          bye_requests?: Json;
          reminder_sent_at?: string | null;
        };
        Relationships: [{ foreignKeyName: "registrations_tournament_id_fkey"; columns: ["tournament_id"]; isOneToOne: false; referencedRelation: "tournaments"; referencedColumns: ["id"] }, { foreignKeyName: "registrations_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      resources: {
        Row: {
          id: string;
          title: Json;
          description: Json;
          kind: string;
          url: string;
          level: string | null;
          language: string;
          is_premium: boolean;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: Json;
          description?: Json;
          kind: string;
          url: string;
          level?: string | null;
          language?: string;
          is_premium?: boolean;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: Json;
          description?: Json;
          kind?: string;
          url?: string;
          level?: string | null;
          language?: string;
          is_premium?: boolean;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rounds: {
        Row: {
          id: string;
          tournament_id: string;
          number: number;
          status: string;
          starts_at: string | null;
          published_at: string | null;
          created_at: string;
          updated_at: string;
          pairing_engine: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          number: number;
          status?: string;
          starts_at?: string | null;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
          pairing_engine?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          tournament_id?: string;
          number?: number;
          status?: string;
          starts_at?: string | null;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
          pairing_engine?: string | null;
          notes?: string | null;
        };
        Relationships: [{ foreignKeyName: "rounds_tournament_id_fkey"; columns: ["tournament_id"]; isOneToOne: false; referencedRelation: "tournaments"; referencedColumns: ["id"] }];
      };
      scoring_scales: {
        Row: {
          id: string;
          name: string;
          places: number[];
          participation: number;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          places: number[];
          participation?: number;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          places?: number[];
          participation?: number;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      seasons: {
        Row: {
          id: string;
          slug: string;
          name: string;
          starts_on: string;
          ends_on: string;
          status: string;
          league_rules: Json;
          license_fee_xof: number | null;
          tour_best_results: number;
          masters_qualified: number;
          masters_invited: number;
          is_demo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          starts_on: string;
          ends_on: string;
          status?: string;
          league_rules?: Json;
          license_fee_xof?: number | null;
          tour_best_results?: number;
          masters_qualified?: number;
          masters_invited?: number;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          starts_on?: string;
          ends_on?: string;
          status?: string;
          league_rules?: Json;
          license_fee_xof?: number | null;
          tour_best_results?: number;
          masters_qualified?: number;
          masters_invited?: number;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      standings: {
        Row: {
          id: string;
          tournament_id: string;
          player_id: string;
          rank: number;
          points: number;
          games: number | null;
          tiebreaks: Json;
          performance: number | null;
          rating_before: number | null;
          rating_after: number | null;
          rating_delta: number | null;
          prize: string | null;
          is_final: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          player_id: string;
          rank: number;
          points: number;
          games?: number | null;
          tiebreaks?: Json;
          performance?: number | null;
          rating_before?: number | null;
          rating_after?: number | null;
          rating_delta?: number | null;
          prize?: string | null;
          is_final?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tournament_id?: string;
          player_id?: string;
          rank?: number;
          points?: number;
          games?: number | null;
          tiebreaks?: Json;
          performance?: number | null;
          rating_before?: number | null;
          rating_after?: number | null;
          rating_delta?: number | null;
          prize?: string | null;
          is_final?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "standings_tournament_id_fkey"; columns: ["tournament_id"]; isOneToOne: false; referencedRelation: "tournaments"; referencedColumns: ["id"] }, { foreignKeyName: "standings_player_id_fkey"; columns: ["player_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      team_matches: {
        Row: {
          id: string;
          tournament_id: string;
          round_number: number;
          table_number: number;
          home_team_id: string;
          away_team_id: string | null;
          published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          round_number: number;
          table_number: number;
          home_team_id: string;
          away_team_id?: string | null;
          published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tournament_id?: string;
          round_number?: number;
          table_number?: number;
          home_team_id?: string;
          away_team_id?: string | null;
          published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "team_matches_tournament_id_fkey"; columns: ["tournament_id"]; isOneToOne: false; referencedRelation: "tournaments"; referencedColumns: ["id"] }, { foreignKeyName: "team_matches_home_team_id_fkey"; columns: ["home_team_id"]; isOneToOne: false; referencedRelation: "teams"; referencedColumns: ["id"] }, { foreignKeyName: "team_matches_away_team_id_fkey"; columns: ["away_team_id"]; isOneToOne: false; referencedRelation: "teams"; referencedColumns: ["id"] }];
      };
      team_members: {
        Row: {
          id: string;
          team_id: string;
          profile_id: string;
          board_order: number;
          is_substitute: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          profile_id: string;
          board_order: number;
          is_substitute?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          team_id?: string;
          profile_id?: string;
          board_order?: number;
          is_substitute?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "team_members_team_id_fkey"; columns: ["team_id"]; isOneToOne: false; referencedRelation: "teams"; referencedColumns: ["id"] }, { foreignKeyName: "team_members_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      teams: {
        Row: {
          id: string;
          tournament_id: string;
          name: string;
          organization_id: string | null;
          captain_id: string | null;
          seed: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          name: string;
          organization_id?: string | null;
          captain_id?: string | null;
          seed?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tournament_id?: string;
          name?: string;
          organization_id?: string | null;
          captain_id?: string | null;
          seed?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "teams_tournament_id_fkey"; columns: ["tournament_id"]; isOneToOne: false; referencedRelation: "tournaments"; referencedColumns: ["id"] }, { foreignKeyName: "teams_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] }, { foreignKeyName: "teams_captain_id_fkey"; columns: ["captain_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      tour_points: {
        Row: {
          id: string;
          stage_id: string;
          profile_id: string;
          rank: number;
          points: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          stage_id: string;
          profile_id: string;
          rank: number;
          points: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          stage_id?: string;
          profile_id?: string;
          rank?: number;
          points?: number;
          created_at?: string;
        };
        Relationships: [{ foreignKeyName: "tour_points_stage_id_fkey"; columns: ["stage_id"]; isOneToOne: false; referencedRelation: "tour_stages"; referencedColumns: ["id"] }, { foreignKeyName: "tour_points_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      tour_stages: {
        Row: {
          id: string;
          season_id: string;
          tournament_id: string | null;
          number: number;
          name: string;
          city: string | null;
          planned_on: string | null;
          kind: string;
          coefficient: number;
          scale_id: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          season_id: string;
          tournament_id?: string | null;
          number: number;
          name: string;
          city?: string | null;
          planned_on?: string | null;
          kind?: string;
          coefficient?: number;
          scale_id?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          season_id?: string;
          tournament_id?: string | null;
          number?: number;
          name?: string;
          city?: string | null;
          planned_on?: string | null;
          kind?: string;
          coefficient?: number;
          scale_id?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "tour_stages_season_id_fkey"; columns: ["season_id"]; isOneToOne: false; referencedRelation: "seasons"; referencedColumns: ["id"] }, { foreignKeyName: "tour_stages_tournament_id_fkey"; columns: ["tournament_id"]; isOneToOne: true; referencedRelation: "tournaments"; referencedColumns: ["id"] }, { foreignKeyName: "tour_stages_scale_id_fkey"; columns: ["scale_id"]; isOneToOne: false; referencedRelation: "scoring_scales"; referencedColumns: ["id"] }];
      };
      tournament_audit: {
        Row: {
          id: string;
          tournament_id: string;
          actor_user_id: string | null;
          action: string;
          details: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          actor_user_id?: string | null;
          action: string;
          details?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tournament_id?: string;
          actor_user_id?: string | null;
          action?: string;
          details?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "tournament_audit_tournament_id_fkey"; columns: ["tournament_id"]; isOneToOne: false; referencedRelation: "tournaments"; referencedColumns: ["id"] }];
      };
      tournament_partners: {
        Row: {
          id: string;
          tournament_id: string;
          name: string;
          role: string;
          url: string | null;
          logo_path: string | null;
          position: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          name: string;
          role?: string;
          url?: string | null;
          logo_path?: string | null;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tournament_id?: string;
          name?: string;
          role?: string;
          url?: string | null;
          logo_path?: string | null;
          position?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "tournament_partners_tournament_id_fkey"; columns: ["tournament_id"]; isOneToOne: false; referencedRelation: "tournaments"; referencedColumns: ["id"] }];
      };
      tournament_staff: {
        Row: {
          id: string;
          tournament_id: string;
          profile_id: string;
          role: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tournament_id: string;
          profile_id: string;
          role: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tournament_id?: string;
          profile_id?: string;
          role?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{ foreignKeyName: "tournament_staff_tournament_id_fkey"; columns: ["tournament_id"]; isOneToOne: false; referencedRelation: "tournaments"; referencedColumns: ["id"] }, { foreignKeyName: "tournament_staff_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }];
      };
      tournaments: {
        Row: {
          id: string;
          slug: string;
          name: string;
          edition: string | null;
          summary: Json;
          description: Json;
          venue: string | null;
          address: string | null;
          city: string | null;
          country: string;
          lat: number | null;
          lng: number | null;
          starts_at: string;
          ends_at: string | null;
          checkin_opens_at: string | null;
          registration_opens_at: string | null;
          registration_closes_at: string | null;
          cadence: Database["public"]["Enums"]["cadence"] | null;
          base_minutes: number | null;
          increment_seconds: number | null;
          rounds_count: number | null;
          pairing_system: string;
          tiebreaks: string[];
          categories: Json;
          conditions: Json;
          entry_fee_xof: number | null;
          entry_fee_notes: Json;
          capacity: number | null;
          is_online: boolean;
          rated: boolean;
          counts_for_tour: boolean;
          league_id: string | null;
          status: Database["public"]["Enums"]["tournament_status"];
          validation_mode: string;
          waitlist_enabled: boolean;
          allow_online_payment: boolean;
          allow_on_site_payment: boolean;
          results_published: boolean;
          organizer_profile_id: string | null;
          organization_id: string | null;
          poster_path: string | null;
          contact_phone: string | null;
          unconfirmed_fields: string[];
          duplicated_from: string | null;
          is_demo: boolean;
          search_text: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          initial_color: string;
          bye_points: number;
          lichess_kind: string | null;
          lichess_id: string | null;
          lichess_imported_at: string | null;
          team_scoring: string;
          team_size: number;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          edition?: string | null;
          summary?: Json;
          description?: Json;
          venue?: string | null;
          address?: string | null;
          city?: string | null;
          country?: string;
          lat?: number | null;
          lng?: number | null;
          starts_at: string;
          ends_at?: string | null;
          checkin_opens_at?: string | null;
          registration_opens_at?: string | null;
          registration_closes_at?: string | null;
          cadence?: Database["public"]["Enums"]["cadence"] | null;
          base_minutes?: number | null;
          increment_seconds?: number | null;
          rounds_count?: number | null;
          pairing_system?: string;
          tiebreaks?: string[];
          categories?: Json;
          conditions?: Json;
          entry_fee_xof?: number | null;
          entry_fee_notes?: Json;
          capacity?: number | null;
          is_online?: boolean;
          rated?: boolean;
          counts_for_tour?: boolean;
          league_id?: string | null;
          status?: Database["public"]["Enums"]["tournament_status"];
          validation_mode?: string;
          waitlist_enabled?: boolean;
          allow_online_payment?: boolean;
          allow_on_site_payment?: boolean;
          results_published?: boolean;
          organizer_profile_id?: string | null;
          organization_id?: string | null;
          poster_path?: string | null;
          contact_phone?: string | null;
          unconfirmed_fields?: string[];
          duplicated_from?: string | null;
          is_demo?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          initial_color?: string;
          bye_points?: number;
          lichess_kind?: string | null;
          lichess_id?: string | null;
          lichess_imported_at?: string | null;
          team_scoring?: string;
          team_size?: number;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          edition?: string | null;
          summary?: Json;
          description?: Json;
          venue?: string | null;
          address?: string | null;
          city?: string | null;
          country?: string;
          lat?: number | null;
          lng?: number | null;
          starts_at?: string;
          ends_at?: string | null;
          checkin_opens_at?: string | null;
          registration_opens_at?: string | null;
          registration_closes_at?: string | null;
          cadence?: Database["public"]["Enums"]["cadence"] | null;
          base_minutes?: number | null;
          increment_seconds?: number | null;
          rounds_count?: number | null;
          pairing_system?: string;
          tiebreaks?: string[];
          categories?: Json;
          conditions?: Json;
          entry_fee_xof?: number | null;
          entry_fee_notes?: Json;
          capacity?: number | null;
          is_online?: boolean;
          rated?: boolean;
          counts_for_tour?: boolean;
          league_id?: string | null;
          status?: Database["public"]["Enums"]["tournament_status"];
          validation_mode?: string;
          waitlist_enabled?: boolean;
          allow_online_payment?: boolean;
          allow_on_site_payment?: boolean;
          results_published?: boolean;
          organizer_profile_id?: string | null;
          organization_id?: string | null;
          poster_path?: string | null;
          contact_phone?: string | null;
          unconfirmed_fields?: string[];
          duplicated_from?: string | null;
          is_demo?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
          initial_color?: string;
          bye_points?: number;
          lichess_kind?: string | null;
          lichess_id?: string | null;
          lichess_imported_at?: string | null;
          team_scoring?: string;
          team_size?: number;
        };
        Relationships: [{ foreignKeyName: "tournaments_organizer_profile_id_fkey"; columns: ["organizer_profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }, { foreignKeyName: "tournaments_organization_id_fkey"; columns: ["organization_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] }, { foreignKeyName: "tournaments_duplicated_from_fkey"; columns: ["duplicated_from"]; isOneToOne: false; referencedRelation: "tournaments"; referencedColumns: ["id"] }, { foreignKeyName: "tournaments_league_fk"; columns: ["league_id"]; isOneToOne: false; referencedRelation: "leagues"; referencedColumns: ["id"] }, { foreignKeyName: "tournaments_country_fk"; columns: ["country"]; isOneToOne: false; referencedRelation: "countries"; referencedColumns: ["code"] }];
      };
      user_badges: {
        Row: {
          profile_id: string;
          badge_code: string;
          awarded_at: string;
          context: string | null;
        };
        Insert: {
          profile_id: string;
          badge_code: string;
          awarded_at?: string;
          context?: string | null;
        };
        Update: {
          profile_id?: string;
          badge_code?: string;
          awarded_at?: string;
          context?: string | null;
        };
        Relationships: [{ foreignKeyName: "user_badges_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }, { foreignKeyName: "user_badges_badge_code_fkey"; columns: ["badge_code"]; isOneToOne: false; referencedRelation: "badges"; referencedColumns: ["code"] }];
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: Database["public"]["Enums"]["app_role"];
          scope_id: string | null;
          granted_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: Database["public"]["Enums"]["app_role"];
          scope_id?: string | null;
          granted_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          scope_id?: string | null;
          granted_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      weekly_challenges: {
        Row: {
          id: string;
          week_start: string;
          title: Json;
          puzzle_ids: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          week_start: string;
          title: Json;
          puzzle_ids: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          week_start?: string;
          title?: Json;
          puzzle_ids?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      whatsapp_inbound: {
        Row: {
          id: string;
          message_id: string;
          wa_from: string;
          body: string | null;
          intent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          message_id: string;
          wa_from: string;
          body?: string | null;
          intent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          message_id?: string;
          wa_from?: string;
          body?: string | null;
          intent?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      wishlists: {
        Row: {
          profile_id: string;
          product_id: string;
          created_at: string;
        };
        Insert: {
          profile_id: string;
          product_id: string;
          created_at?: string;
        };
        Update: {
          profile_id?: string;
          product_id?: string;
          created_at?: string;
        };
        Relationships: [{ foreignKeyName: "wishlists_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] }, { foreignKeyName: "wishlists_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] }];
      };
    };
    Views: {
      league_standings: {
        Row: {
          league_id: string | null;
          player_id: string | null;
          points: number | null;
          sonneborn_berger: number | null;
          games: number | null;
          matchdays: number | null;
          rank: number | null;
          display_name: string | null;
          club: string | null;
          titles: string[] | null;
        };
        Relationships: [];
      };
      lesson_catalog: {
        Row: {
          id: string | null;
          slug: string | null;
          level: string | null;
          theme: string | null;
          title: Json | null;
          summary: Json | null;
          position: number | null;
          is_premium: boolean | null;
        };
        Relationships: [];
      };
      prediction_leaderboard: {
        Row: {
          profile_id: string | null;
          display_name: string | null;
          points: number | null;
          predictions: number | null;
        };
        Relationships: [];
      };
      public_arbiters: {
        Row: {
          profile_id: string | null;
          title: string | null;
          zone: string | null;
          availability: string | null;
          languages: string[] | null;
          verified: boolean | null;
          display_name: string | null;
          city: string | null;
          department: string | null;
          country: string | null;
          is_demo: boolean | null;
        };
        Relationships: [];
      };
      public_board_results: {
        Row: {
          team_match_id: string | null;
          board: number | null;
          home_is_white: boolean | null;
          result: Database["public"]["Enums"]["game_result"] | null;
          white_name: string | null;
          black_name: string | null;
        };
        Relationships: [];
      };
      public_coaches: {
        Row: {
          id: string | null;
          slug: string | null;
          headline: Json | null;
          bio: Json | null;
          languages: string[] | null;
          modalities: string[] | null;
          levels: string[] | null;
          specialties: string[] | null;
          city: string | null;
          zone: string | null;
          is_chesspirit: boolean | null;
          rating_avg: number | null;
          reviews_count: number | null;
          is_demo: boolean | null;
          display_name: string | null;
          titles: string[] | null;
          price_from: number | null;
        };
        Relationships: [];
      };
      public_league_members: {
        Row: {
          league_id: string | null;
          profile_id: string | null;
          seed: number | null;
          status: string | null;
          display_name: string | null;
          club: string | null;
          titles: string[] | null;
        };
        Relationships: [];
      };
      public_lichess_accounts: {
        Row: {
          profile_id: string | null;
          username: string | null;
        };
        Relationships: [];
      };
      public_pairings: {
        Row: {
          id: string | null;
          tournament_id: string | null;
          round_number: number | null;
          board: number | null;
          result: Database["public"]["Enums"]["game_result"] | null;
          bye_type: string | null;
          white_id: string | null;
          white_name: string | null;
          black_id: string | null;
          black_name: string | null;
          stage: string | null;
          white_start: number | null;
          black_start: number | null;
        };
        Relationships: [];
      };
      public_profiles: {
        Row: {
          id: string | null;
          first_name: string | null;
          last_name: string | null;
          display_name: string | null;
          photo_path: string | null;
          country: string | null;
          department: string | null;
          city: string | null;
          club_id: string | null;
          club_name: string | null;
          fide_id: string | null;
          titles: string[] | null;
          languages: string[] | null;
          bio: string | null;
          sex: Database["public"]["Enums"]["sex"] | null;
          verified: boolean | null;
          is_demo: boolean | null;
          birth_year: number | null;
          is_minor: boolean | null;
          search_text: string | null;
        };
        Relationships: [];
      };
      public_ratings: {
        Row: {
          type: Database["public"]["Enums"]["rating_type"] | null;
          rating: number | null;
          games: number | null;
          provisional: boolean | null;
          peak: number | null;
          profile_id: string | null;
          display_name: string | null;
          club_name: string | null;
          city: string | null;
          department: string | null;
          sex: Database["public"]["Enums"]["sex"] | null;
          birth_year: number | null;
          titles: string[] | null;
          fide_id: string | null;
          is_demo: boolean | null;
          rank: number | null;
        };
        Relationships: [];
      };
      public_registrations: {
        Row: {
          tournament_id: string | null;
          registration_id: string | null;
          player_id: string | null;
          display_name: string | null;
          club: string | null;
          city: string | null;
          seed_rating: number | null;
          titles: string[] | null;
          fide_id: string | null;
          sex: Database["public"]["Enums"]["sex"] | null;
          status: Database["public"]["Enums"]["registration_status"] | null;
          created_at: string | null;
        };
        Relationships: [];
      };
      public_standings: {
        Row: {
          tournament_id: string | null;
          rank: number | null;
          points: number | null;
          games: number | null;
          tiebreaks: Json | null;
          performance: number | null;
          rating_before: number | null;
          rating_after: number | null;
          rating_delta: number | null;
          prize: string | null;
          is_final: boolean | null;
          player_id: string | null;
          display_name: string | null;
          club: string | null;
          titles: string[] | null;
          fide_id: string | null;
          sex: Database["public"]["Enums"]["sex"] | null;
        };
        Relationships: [];
      };
      public_team_members: {
        Row: {
          team_id: string | null;
          tournament_id: string | null;
          profile_id: string | null;
          board_order: number | null;
          is_substitute: boolean | null;
          display_name: string | null;
          titles: string[] | null;
        };
        Relationships: [];
      };
      resource_catalog: {
        Row: {
          id: string | null;
          title: Json | null;
          description: Json | null;
          kind: string | null;
          level: string | null;
          language: string | null;
          is_premium: boolean | null;
          created_at: string | null;
          url: string | null;
        };
        Relationships: [];
      };
      tour_standings: {
        Row: {
          season_id: string | null;
          profile_id: string | null;
          total: number | null;
          stages: number | null;
          rank: number | null;
          display_name: string | null;
          club: string | null;
          titles: string[] | null;
          sex: Database["public"]["Enums"]["sex"] | null;
          age: number | null;
          is_woman: boolean | null;
          rapid_rating: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      add_child: { Args: { p_profile: Json; p_image_rights?: boolean }; Returns: Database["public"]["Tables"]["profiles"]["Row"] };
      add_tournament_staff: { Args: { p_tournament_id: string; p_identifier: string; p_role: string }; Returns: Database["public"]["Tables"]["tournament_staff"]["Row"] };
      admin_alerts: { Args: Record<PropertyKey, never>; Returns: { kind: string; count: number; detail: string }[] };
      admin_anonymize_profile: { Args: { p_profile: string }; Returns: string };
      admin_find_duplicates: { Args: { p_profile: string }; Returns: { id: string; first_name: string; last_name: string; birth_date: string; phone: string; fide_id: string; user_id: string; reason: string }[] };
      admin_merge_profiles: { Args: { p_keep: string; p_merge: string }; Returns: number };
      admin_overview: { Args: Record<PropertyKey, never>; Returns: { users: number; profiles: number; registrations: number; payments_succeeded: number; revenue_xof: number; pending_data_requests: number; contact_new: number }[] };
      admin_record_refund: { Args: { p_payment: string; p_amount: number; p_reason: string }; Returns: Database["public"]["Tables"]["refunds"]["Row"] };
      admin_stats: { Args: { p_from: string; p_to: string }; Returns: Json };
      agree_postponement: { Args: { p_id: string }; Returns: undefined };
      allocate_season_by_rating: { Args: { p_season: string }; Returns: number };
      approve_coach_application: { Args: { p_application_id: string }; Returns: Database["public"]["Tables"]["coach_profiles"]["Row"] };
      assign_start_numbers: { Args: { p_tournament_id: string; p_only_checked_in?: boolean }; Returns: number };
      award_results: { Args: { p_edition: string }; Returns: { category_id: string; nominee_id: string; votes: number }[] };
      book_slot: { Args: { p_slot_id: string; p_offer_id: string; p_student_id: string; p_notes?: string }; Returns: Database["public"]["Tables"]["bookings"]["Row"] };
      cancel_booking: { Args: { p_booking_id: string }; Returns: Database["public"]["Tables"]["bookings"]["Row"] };
      cancel_order: { Args: { p_order_id: string; p_note?: string }; Returns: Database["public"]["Tables"]["orders"]["Row"] };
      cancel_registration: { Args: { p_registration_id: string }; Returns: Database["public"]["Tables"]["registrations"]["Row"] };
      cast_award_vote: { Args: { p_nominee: string }; Returns: undefined };
      challenge_leaderboard: { Args: { p_challenge: string }; Returns: { display_name: string; solved: number }[] };
      check_in: { Args: { p_ticket_code: string; p_mark_paid?: boolean }; Returns: { registration_id: string; tournament_id: string; display_name: string; status: Database["public"]["Enums"]["registration_status"]; payment_status: Database["public"]["Enums"]["payment_status"]; checked_in_at: string; already: boolean }[] };
      check_promo: { Args: { p_code: string; p_subtotal: number }; Returns: { valid: boolean; kind: string; discount_xof: number }[] };
      claim_referral: { Args: { p_code: string }; Returns: boolean };
      close_league: { Args: { p_league: string }; Returns: string };
      complete_onboarding: { Args: { p_profile: Json; p_consents: Json; p_version?: string }; Returns: Database["public"]["Tables"]["profiles"]["Row"] };
      compute_tour_points: { Args: { p_tournament: string }; Returns: number };
      confirm_payment: { Args: { p_payment_id: string; p_status: string; p_provider_ref: string; p_reason?: string }; Returns: Database["public"]["Tables"]["payments"]["Row"] };
      create_league_matchday: { Args: { p_league: string; p_date?: string }; Returns: string };
      daily_puzzle: { Args: { p_day?: string }; Returns: Database["public"]["Tables"]["puzzles"]["Row"] };
      decide_listing_claim: { Args: { p_claim: string; p_approve: boolean }; Returns: undefined };
      duplicate_tournament: { Args: { p_tournament_id: string; p_slug: string; p_starts_at: string }; Returns: Database["public"]["Tables"]["tournaments"]["Row"] };
      gift_card_balance: { Args: { p_code: string }; Returns: number };
      import_standings: { Args: { p_tournament_id: string; p_rows: Json; p_publish?: boolean }; Returns: number };
      log_admin_view: { Args: { p_object_type: string; p_object_id: string; p_context: string }; Returns: undefined };
      log_personal_data_access: { Args: { p_profile_id: string; p_context: string }; Returns: undefined };
      loyalty_balance: { Args: Record<PropertyKey, never>; Returns: number };
      member_progress: { Args: { p_profile: string }; Returns: { tournaments: number; games: number; puzzles: number; lessons_booked: number; predictions: number }[] };
      my_managed_tournaments: { Args: Record<PropertyKey, never>; Returns: Database["public"]["Tables"]["tournaments"]["Row"][] };
      my_referral_code: { Args: Record<PropertyKey, never>; Returns: string };
      place_order: { Args: { p_items: Json; p_delivery: string; p_address: Json; p_contact_name: string; p_contact_phone: string; p_contact_email?: string; p_promo?: string; p_gift_code?: string; p_use_points?: number; p_notes?: string }; Returns: Database["public"]["Tables"]["orders"]["Row"] };
      position_explorer: { Args: { p_fen_key: string }; Returns: { next_san: string; games: number; white_wins: number; draws: number; black_wins: number }[] };
      predict: { Args: { p_pairing: string; p_result: string }; Returns: undefined };
      propose_organization: { Args: { p_org: Json }; Returns: string };
      public_stats: { Args: Record<PropertyKey, never>; Returns: { rated_players: number; tournaments: number; games: number; demo: boolean }[] };
      purge_whatsapp_inbound: { Args: Record<PropertyKey, never>; Returns: number };
      pvm_tally: { Args: { p_game: string }; Returns: { move: string; votes: number }[] };
      pvm_vote: { Args: { p_game: string; p_move: string }; Returns: undefined };
      refresh_badges: { Args: { p_profile: string }; Returns: number };
      refresh_league_forfeits: { Args: { p_league: string }; Returns: number };
      register_for_tournament: { Args: { p_tournament_id: string; p_player_id: string; p_answers?: Json; p_payment_method?: string }; Returns: Database["public"]["Tables"]["registrations"]["Row"] };
      request_league_license: { Args: { p_season: string; p_profile: string }; Returns: Database["public"]["Tables"]["league_licenses"]["Row"] };
      request_membership: { Args: { p_plan: string }; Returns: Database["public"]["Tables"]["memberships"]["Row"] };
      run_maintenance: { Args: { p_job: string }; Returns: Json };
      set_order_status: { Args: { p_order_id: string; p_status: Database["public"]["Enums"]["order_status"]; p_note?: string }; Returns: Database["public"]["Tables"]["orders"]["Row"] };
      shop_overview: { Args: Record<PropertyKey, never>; Returns: { orders_to_process: number; revenue_xof: number; low_stock: number; pending_payment: number }[] };
      slot_remaining: { Args: { p_slot_id: string }; Returns: number };
      ticket_info: { Args: { p_ticket_code: string }; Returns: { display_name: string; tournament_name: string; tournament_slug: string; starts_at: string; venue: string; status: Database["public"]["Enums"]["registration_status"]; payment_status: Database["public"]["Enums"]["payment_status"]; checked_in: boolean }[] };
      tournament_staff_list: { Args: { p_tournament_id: string }; Returns: { id: string; role: string; profile_id: string; name: string; phone: string; email: string }[] };
      track_order: { Args: { p_number: string; p_phone: string }; Returns: { number: string; status: Database["public"]["Enums"]["order_status"]; delivery_method: string; created_at: string; events: Json }[] };
    };
    Enums: {
      app_role: "player" | "parent" | "coach" | "arbiter" | "organizer" | "editor" | "partner" | "admin" | "super_admin" | "admin_competitions" | "admin_shop" | "moderator";
      cadence: "blitz" | "rapid" | "classical";
      consent_type: "terms" | "newsletter" | "public_profile" | "image_rights" | "parental";
      game_result: "1-0" | "0-1" | "1/2-1/2" | "+-" | "-+" | "=-=" | "0-0";
      order_status: "pending_payment" | "paid" | "preparing" | "ready_for_pickup" | "shipped" | "delivered" | "cancelled" | "refunded";
      org_type: "club" | "school" | "organizer" | "association" | "departmental_league" | "federation" | "vendor" | "content_creator" | "media" | "university" | "company";
      payment_status: "not_required" | "pending" | "paid" | "due_on_site" | "refunded" | "failed";
      rating_type: "blitz" | "rapid" | "classical" | "online";
      registration_status: "pending_payment" | "pending_validation" | "confirmed" | "waitlisted" | "cancelled" | "refused";
      sex: "M" | "F";
      tournament_status: "draft" | "published" | "registration_open" | "registration_closed" | "ongoing" | "finished" | "archived" | "cancelled";
    };
    CompositeTypes: Record<string, never>;
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Views<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
