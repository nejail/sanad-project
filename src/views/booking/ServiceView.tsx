import React, { useEffect, useMemo } from 'react';
import { Alert, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Banner, Chip, Field, IconName, OptionRow, PriceSummary, PrimaryButton, Screen, SectionLabel } from '../../components/ui';
import { getService } from '../../models/catalog';
import { buildQuote, isFirstWashFree } from '../../models/pricing';
import { ScreenProps } from '../../navigation/types';
import { pickCarPhoto } from '../../services/media';
import { useAccount, useApp } from '../../viewModels/AppContext';
import { colors, font } from '../../theme';

const LITRES = [20, 40, 60];
const TOW_KM = [2, 5, 10, 20];

/** 04 Service screens (Battery, Fuel Delivery, Car Wash, Tire Service, Oil Change, Emergency 24/7). */
export default function ServiceView({ navigation, route }: ScreenProps<'Service'>) {
  const service = getService(route.params.serviceId);
  const { draft, updateDraft } = useApp();
  const { orders } = useAccount();
  const firstWashFree = isFirstWashFree(orders);
  const danger = service.accent === 'danger';
  const optionId = draft.optionId ?? service.options[0].id;

  useEffect(() => {
    if (!draft.optionId || draft.serviceId !== service.id) {
      updateDraft({ serviceId: service.id, optionId: service.options[0].id, litres: 40, distanceKm: 2 });
    }
  }, [service.id]);

  const quote = useMemo(
    () => buildQuote({ serviceId: service.id, optionId, addOnIds: draft.addOnIds, litres: draft.litres, distanceKm: draft.distanceKm, firstWashFree }),
    [service.id, optionId, draft.addOnIds, draft.litres, draft.distanceKm, firstWashFree],
  );

  const toggleAddOn = (id: string) =>
    updateDraft({ addOnIds: draft.addOnIds.includes(id) ? draft.addOnIds.filter((x) => x !== id) : [...draft.addOnIds, id] });

  const attach = async (source: 'camera' | 'library') => {
    try {
      const uri = await pickCarPhoto(source);
      if (uri) updateDraft({ photoUri: uri });
    } catch (e) {
      Alert.alert('Photo unavailable', (e as Error).message);
    }
  };

  const askPhoto = () =>
    Platform.OS === 'web'
      ? attach('library')
      : Alert.alert('Add a photo', 'Show the provider what is wrong with the car.', [
      { text: 'Take Photo', onPress: () => attach('camera') },
      { text: 'Choose from Library', onPress: () => attach('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);

  return (
    <Screen
      title={service.title}
      footer={<PrimaryButton label="Continue" onPress={() => navigation.navigate('SelectVehicle')} testID="service-continue" />}
    >
      {danger ? (
        <View style={styles.sos}>
          <Ionicons name="alert-circle" size={18} color={colors.danger} />
          <Text style={{ color: '#fecaca', flex: 1, fontSize: 13 }}>In danger or blocking traffic? Call 999 first, then request help here.</Text>
        </View>
      ) : null}
      {service.id === 'carwash' && firstWashFree ? (
        <Banner icon="gift-outline" text="Launch Special: your first car wash package is free. Add-ons are still charged." />
      ) : null}
      <SectionLabel>{service.prompt}</SectionLabel>
      {service.options.map((o) => (
        <OptionRow
          key={o.id}
          testID={`option-${o.id}`}
          icon={o.icon as IconName}
          title={o.title}
          subtitle={o.subtitle}
          right={o.priceLabel}
          danger={danger}
          selected={optionId === o.id}
          onPress={() => updateDraft({ optionId: o.id })}
        />
      ))}

      {service.pricing === 'perLitre' ? (
        <>
          <SectionLabel>Amount</SectionLabel>
          <View style={styles.chips}>
            {LITRES.map((l) => <Chip key={l} label={`${l} Liters`} selected={draft.litres === l} onPress={() => updateDraft({ litres: l })} />)}
          </View>
        </>
      ) : null}

      {service.addOns ? (
        <>
          <SectionLabel>Add-ons (optional)</SectionLabel>
          <View style={styles.chips}>
            {service.addOns.map((a) => (
              <Chip key={a.id} label={`${a.title} +${a.price}`} selected={draft.addOnIds.includes(a.id)} onPress={() => toggleAddOn(a.id)} />
            ))}
          </View>
        </>
      ) : null}

      {service.pricing === 'towing' && optionId === 'towing' ? (
        <>
          <SectionLabel>Estimated distance to garage</SectionLabel>
          <Text style={font.small}>You can pick the exact garage on the review screen; the price then uses the real road distance.</Text>
          <View style={styles.chips}>
            {TOW_KM.map((k) => <Chip key={k} label={`${k} km`} selected={draft.distanceKm === k} onPress={() => updateDraft({ distanceKm: k })} />)}
          </View>
        </>
      ) : null}

      <Field
        label={service.notesLabel}
        value={draft.notes ?? ''}
        onChangeText={(t) => updateDraft({ notes: t })}
        placeholder={service.notesPlaceholder}
      />

      <SectionLabel>Photo (optional)</SectionLabel>
      {draft.photoUri ? (
        <View style={styles.photoRow}>
          <Image source={{ uri: draft.photoUri }} style={styles.photo} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={font.small}>Photo attached. The provider will see it with your request.</Text>
            <Text style={{ color: colors.danger, fontWeight: '600' }} onPress={() => updateDraft({ photoUri: undefined })}>Remove</Text>
          </View>
        </View>
      ) : (
        <Pressable style={styles.addPhoto} onPress={askPhoto} testID="add-photo">
          <Ionicons name="camera-outline" size={20} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '600' }}>Add a photo of the car</Text>
        </Pressable>
      )}

      <PriceSummary quote={quote} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sos: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)' },
  addPhoto: {
    flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', height: 50, borderRadius: 8,
    borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary,
  },
  photoRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  photo: { width: 72, height: 72, borderRadius: 8, backgroundColor: colors.surface },
});
