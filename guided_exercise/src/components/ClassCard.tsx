import { Image, StyleSheet, Text, View } from "react-native";
import LeafImage from '@/src/assets/images/Leaf.png'; 
import { ReactNode } from "react";

export default function ClassCard({
    start,
    end,
    title,
    desc,
    active,
    children
} : {
    start: Date,
    end: Date,
    title: string,
    desc: string,
    active: boolean,
    children: ReactNode
}) {
    const month = start.toLocaleString('en-US', { month: 'short' });
    const day = start.getDate();
    const startTime = start.toLocaleString('en-US', { 
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
    const endTime = end.toLocaleString('en-US', { 
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
    const formatted = start.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    return (
        <View style={[styles.container, active && { backgroundColor: '#C3F5FF' }]}>
            <View style={styles.content}>
                <View style={styles.miniCalendar}>
                    <Text style={styles.miniCalendarText}>{month}</Text>
                    <Text style={styles.miniCalendarText}>{day}</Text>
                </View>

                <Text style={styles.title}>{title}</Text>
                <View style={styles.time}>
                    <Text>{formatted}</Text>
                    <Text>{`${startTime} - ${endTime}`}</Text>
                </View>
                <Text>{desc}</Text>

                {children}
            </View>

            <Image
                source={LeafImage}
                resizeMode="cover"
                style={styles.leaf}
            />
        </View>
    )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#EAFBFF',
    borderRadius: 10,
    marginBottom: 10,
    // Soft shadow for modern look
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  miniCalendar: {
    width: 54,
    height: 54,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: '#00C8B3'
  },
  miniCalendarText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '700'
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '600'
  },
  time: {
    display: 'flex',
    flexDirection: 'row',
    
  },
  leaf: {
    width: 81,
    height: 81,
  }
});
