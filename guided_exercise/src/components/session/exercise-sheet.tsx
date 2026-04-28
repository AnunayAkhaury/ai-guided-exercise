// session/dropdown.tsx
import React, { useMemo, forwardRef } from 'react';
import { View, Text, Pressable, FlatList } from 'react-native';
import { BottomSheetModal, BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';

export type ExerciseType = 'Push Ups' | 'Squats' | 'Lunges' | 'Jumping Jacks';
const EXERCISES: ExerciseType[] = ['Push Ups', 'Squats', 'Lunges', 'Jumping Jacks'];

export const ExerciseSheet = forwardRef<BottomSheetModal, { onSelect: (ex: ExerciseType) => void }>((props, ref) => {
  const snapPoints = useMemo(() => ['40', '60%'], []);

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      backdropComponent={(props) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />}>
      <BottomSheetView style={{ paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: '700' }}>Select Exercise</Text>
          <Pressable onPress={() => (ref as any).current?.dismiss()}>
            <Ionicons name="close" size={24} color="black" />
          </Pressable>
        </View>

        <FlatList
          data={EXERCISES}
          keyExtractor={(n) => n}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                props.onSelect(item);
                (ref as any).current?.dismiss();
              }}
              style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
              <Text style={{ fontSize: 16 }}>{item}</Text>
            </Pressable>
          )}
        />
      </BottomSheetView>
    </BottomSheetModal>
  );
});
