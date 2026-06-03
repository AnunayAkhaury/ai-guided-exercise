import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { View, Text, Pressable, FlatList, Modal, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EXERCISE_TITLE_MAP } from '@/src/constants/exerciseMap';

export const EXERCISES = [
  'alternating-lunge',
  'flamingo',
  'fly',
  'high-kick',
  'knee-pull',
  'lunge',
  'modified-pushup',
  'plank-shoulder-touch',
  'pushup',
  'squat'
] as const;

export type ExerciseType = (typeof EXERCISES)[number];

// Creating a custom ref interface to match how you open/dismiss it
export interface ExerciseSheetRef {
  present: () => void;
  dismiss: () => void;
}

export const ExerciseSheet = forwardRef<ExerciseSheetRef, { onSelect: (ex: ExerciseType) => void }>((props, ref) => {
  const [isVisible, setIsVisible] = useState(false);

  // Expose present/dismiss to the parent component just like @gorhom/bottom-sheet did
  useImperativeHandle(ref, () => ({
    present: () => setIsVisible(true),
    dismiss: () => setIsVisible(false),
  }));

  return (
    <Modal
      transparent={true}
      visible={isVisible}
      animationType="slide" // Smooth slide up from bottom animation
      onRequestClose={() => setIsVisible(false)}
    >
      {/* Backdrop tap to close */}
      <Pressable style={styles.backdrop} onPress={() => setIsVisible(false)}>
        {/* Pointer events none ensures clicks on the sheet content don't trigger the backdrop click */}
        <Pressable style={styles.sheetContainer} onPress={(e) => e.stopPropagation()}>
          
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Select Exercise</Text>
            <Pressable onPress={() => setIsVisible(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color="black" />
            </Pressable>
          </View>

          {/* Core FlatList - Will scroll seamlessly on both iOS and Android */}
          <FlatList
            data={EXERCISES}
            keyExtractor={(item) => item}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  props.onSelect(item);
                  setIsVisible(false);
                }}
                style={({ pressed }) => [
                  styles.itemRow,
                  { backgroundColor: pressed ? '#f5f5f5' : '#ffffff' }
                ]}
                className='border-[1px] border-purple-50 py-5 px-5'
              >
                <Text style={styles.itemText}>{EXERCISE_TITLE_MAP[item]}</Text>
              </Pressable>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
});

const SCREEN_HEIGHT = Dimensions.get('window').height;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end', // Aligns sheet to bottom
  },
  sheetContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: SCREEN_HEIGHT * 0.5, // Emulates your ~50% snapPoint
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: 20,
  },
  itemRow: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  itemText: {
    fontSize: 16,
  },
});