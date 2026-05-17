import { ImageBackground, Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import Typography from "../ui/Typography";
import ActiveClassBg from '@/src/assets/images/ActiveClassBg.jpg'; 
import { AntDesign } from "@expo/vector-icons";

export default function TeacherActiveClassCard({
  start,
  end,
  title,
  desc,
  active,
  onStartPress,
  onCancelPress,
  cancelLabel,
  startLabel,
  actionsDisabled,
  startDisabled,
  cancelDisabled,
  subtitle,
  showSecondaryAction = true,
} : {
  start: Date,
  end: Date,
  title: string,
  desc: string,
  active: boolean,
  onStartPress?: () => void,
  onCancelPress?: () => void,
  cancelLabel?: string,
  startLabel?: string,
  actionsDisabled?: boolean,
  startDisabled?: boolean,
  cancelDisabled?: boolean,
  subtitle?: string,
  showSecondaryAction?: boolean,
}) {
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

    const isStartDisabled = startDisabled ?? actionsDisabled ?? false;
    const isCancelDisabled = cancelDisabled ?? actionsDisabled ?? !onCancelPress;

    if (Platform.OS === 'web') {
      return (
        <ImageBackground
          source={ActiveClassBg}
          resizeMode="cover"
          imageStyle={styles.webBackgroundImage}
          style={styles.webCard}
        >
          <View style={styles.webOverlay}>
            <View style={styles.webHeaderRow}>
              <View style={styles.webTitleBlock}>
                <Typography font='istokWeb-bold' numberOfLines={1} style={styles.webTitle}>
                  {title}
                </Typography>
                <Typography font='istokWeb' numberOfLines={1} style={styles.webSubtitle}>
                  {subtitle ?? 'Ready to start'}
                </Typography>
              </View>
              <View style={styles.webStatusBadge}>
                <Typography font='inter-bold' style={styles.webStatusText}>
                  {active ? 'Live' : 'Scheduled'}
                </Typography>
              </View>
            </View>

            <View style={styles.webMetaRow}>
              <AntDesign name="field-time" size={18} color="#111111" />
              <Typography font='istokWeb-bold' style={styles.webMetaText}>
                {`${startTime} - ${endTime}`}
              </Typography>
            </View>

            <Typography font='istokWeb' numberOfLines={1} style={styles.webDesc}>
              {desc}
            </Typography>

            <View style={styles.webActions}>
              <TouchableOpacity onPress={onStartPress} disabled={isStartDisabled} activeOpacity={0.82}>
                <View style={[styles.webStartButton, isStartDisabled && styles.webStartButtonDisabled]}>
                  <Typography font='inter-bold' numberOfLines={1} style={styles.webStartButtonText}>
                    {startLabel ?? 'Start Meeting'}
                  </Typography>
                </View>
              </TouchableOpacity>
              {showSecondaryAction && (
                <TouchableOpacity onPress={onCancelPress} disabled={isCancelDisabled} activeOpacity={0.82}>
                  <View style={[styles.webCancelButton, isCancelDisabled && styles.webCancelButtonDisabled]}>
                    <Typography font='inter-bold' numberOfLines={1} style={styles.webCancelButtonText}>
                      {cancelLabel ?? 'Cancel'}
                    </Typography>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ImageBackground>
      );
    }

    return (
      <ImageBackground
        source={ActiveClassBg}
        resizeMode="cover"
        imageStyle={styles.backgroundImage}
        style={styles.card}
      >
        <View style={styles.content}>
          <Typography font='istokWeb-bold' className="text-xl self-start">{title}</Typography>

          <Typography font='istokWeb' className="w-full text-start">{subtitle ?? 'Ready to start'}</Typography>
          <View style={styles.timeRow}>
            <AntDesign name="field-time" size={17} color="black" />
            <Typography font='istokWeb' className="text-wrap text-base">
              {`${startTime}-${endTime}`}
            </Typography>
          </View>
          <Typography font='istokWeb' className="w-full text-start text-wrap pb-2">{desc}</Typography>

          <View style={styles.actions}>
            <TouchableOpacity onPress={onStartPress} disabled={isStartDisabled} activeOpacity={0.8}>
              <View style={[styles.startButton, isStartDisabled && styles.disabledButton]}>
                <Typography font='inter-bold' numberOfLines={1} className="text-base text-white">
                  {startLabel ?? 'Start Meeting'}
                </Typography>
              </View>
            </TouchableOpacity>
            {showSecondaryAction && (
              <TouchableOpacity onPress={onCancelPress} disabled={isCancelDisabled} activeOpacity={0.8}>
                <View style={[styles.cancelButton, isCancelDisabled && styles.disabledButton]}>
                  <Typography font='inter-bold' numberOfLines={1} className="text-sm text-white">
                    {cancelLabel ?? 'Cancel'}
                  </Typography>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ImageBackground>
    );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 420 : undefined,
    alignSelf: Platform.OS === 'web' ? 'flex-start' : 'stretch',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5
  },
  backgroundImage: {
    borderRadius: 18
  },
  content: {
    width: '100%',
    padding: 18,
    gap: 4
  },
  timeRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 4
  },
  actions: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    paddingTop: 6
  },
  startButton: {
    minHeight: 38,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#A980FE'
  },
  cancelButton: {
    minHeight: 38,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#FF0000'
  },
  disabledButton: {
    opacity: 0.62
  },
  webCard: {
    width: '100%',
    maxWidth: 680,
    minHeight: 230,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: '#F493B7',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 }
  },
  webBackgroundImage: {
    borderRadius: 24
  },
  webOverlay: {
    flex: 1,
    paddingHorizontal: 28,
    paddingVertical: 26,
    justifyContent: 'space-between'
  },
  webHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 18
  },
  webTitleBlock: {
    flex: 1,
    minWidth: 0
  },
  webTitle: {
    fontSize: 28,
    lineHeight: 34,
    color: '#000000'
  },
  webSubtitle: {
    marginTop: 6,
    fontSize: 17,
    color: '#111111'
  },
  webStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.52)'
  },
  webStatusText: {
    fontSize: 13,
    color: '#4E31C9'
  },
  webMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 18
  },
  webMetaText: {
    fontSize: 19,
    color: '#000000'
  },
  webDesc: {
    paddingTop: 8,
    fontSize: 17,
    color: '#111111'
  },
  webActions: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 22,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.34)'
  },
  webStartButton: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#A980FE'
  },
  webStartButtonText: {
    color: '#FFFFFF',
    fontSize: 16
  },
  webStartButtonDisabled: {
    backgroundColor: '#8F73F7',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.68)',
    shadowColor: '#4F2CCB',
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }
  },
  webCancelButton: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#FF0000'
  },
  webCancelButtonText: {
    color: '#FFFFFF',
    fontSize: 15
  },
  webCancelButtonDisabled: {
    opacity: 0.65
  }
});
