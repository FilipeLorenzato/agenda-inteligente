import React, { useMemo } from 'react';
import { ScrollView } from 'react-native';
import { listCourses } from '../lib/logic';
import { courseStyle, shortCourse } from '../lib/meta';
import { useStore } from '../state/store';
import { useTheme } from '../theme';
import { Chip } from './ui';

/** Fileira de chips para filtrar as tarefas por disciplina */
export function CourseFilter() {
  const p = useTheme();
  const { tasks, settings, courseFilter, setCourseFilter } = useStore();
  const courses = useMemo(() => listCourses(tasks), [tasks]);
  if (!courses.length) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -18, marginTop: 12 }}
      contentContainerStyle={{ paddingHorizontal: 18 }}
    >
      <Chip label="Todas" emoji="🗂️" compact selected={!courseFilter} onPress={() => setCourseFilter(null)} color={p.accent} />
      {courses.map((c) => {
        const cs = courseStyle(c, settings.courseStyles);
        return (
          <Chip
            key={c}
            label={shortCourse(c)}
            emoji={cs.emoji}
            compact
            color={cs.color}
            selected={courseFilter === c}
            onPress={() => setCourseFilter(courseFilter === c ? null : c)}
          />
        );
      })}
    </ScrollView>
  );
}
