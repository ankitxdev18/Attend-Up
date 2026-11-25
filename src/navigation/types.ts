import type { NavigatorScreenParams } from '@react-navigation/native';

export type HomeStackParamList = {
  HomeDashboard: undefined;
  SubjectDetail: { subjectId: string };
};

export type RootDrawerParamList = {
  HomeStack: NavigatorScreenParams<HomeStackParamList>;
  QuickAttendance: undefined;
  SearchAttendance: { initialSubjectId?: string } | undefined;
  Reports: undefined;
  BackupRestore: undefined;
  Settings: undefined;
};
