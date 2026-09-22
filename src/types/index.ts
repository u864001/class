export type RoomStatus = 'idle' | 'published' | 'answering' | 'stopped';
export type QuestionType = 'choice' | 'text' | 'image';

export interface Room {
  id: string;
  teacher_name: string;
  status: RoomStatus;
  current_question_num: number;
  current_round_id: string | null;
  question_type: QuestionType;
  question_note: string;
  question_score: number;
  question_image_url: string | null;
  timer_seconds: number;
  answering_started_at: string | null;
  revealed_answer: string | null;
  selected_classes: string[];
  custom_class_enabled: boolean;
  custom_student_count: number;
  cumulative_scores: Record<string, number>;
  broadcast_text: string;
  broadcast_image_url: string;
  screen_locked: boolean;
  vote_active: boolean;
  vote_options: string[];
  vote_results: Record<string, number>;
  buzz_active: boolean;
  buzz_countdown: number;
  groups: string[];
  group_scores: Record<string, number>;
  created_at: string;
}

export interface Submission {
  id: string;
  room_id: string;
  round_id: string;
  student_id: string;
  student_name: string;
  choice: string | null;
  text_answer: string | null;
  image_url: string | null;
  earned_score: number;
  created_at: string;
}

export interface RoomStudent {
  room_id: string;
  student_id: string;
  student_name: string;
  is_online: boolean;
  last_seen: string;
}

export interface BuzzEntry {
  id: string;
  room_id: string;
  student_id: string;
  student_name: string;
  buzz_time: string;
}

export interface VoteEntry {
  id: string;
  room_id: string;
  student_id: string;
  student_name: string;
  option: string;
  created_at: string;
}

export interface ClassRosterStudent {
  grade: string;
  class: string;
  number: string;
  name: string;
}
