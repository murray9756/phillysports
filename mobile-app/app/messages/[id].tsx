import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { messagingService } from '@/services/api';
import { pusherService } from '@/services/pusher';

interface Message {
  _id: string;
  content: string;
  senderId: string;
  createdAt: string;
}

export default function ConversationScreen() {
  const { id, username } = useLocalSearchParams<{ id: string; username: string }>();
  const { colors } = useTheme();
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');

  useEffect(() => {
    loadMessages();

    // Subscribe to real-time messages
    const unsubscribe = pusherService.subscribeToUserNotifications(user?._id || '', (data) => {
      if (data.type === 'new_message' && data.conversationId === id) {
        setMessages((prev) => [...prev, data.message]);
      }
    });

    return () => {
      // Cleanup subscription
    };
  }, [id]);

  const loadMessages = async () => {
    try {
      const data = await messagingService.getMessages(id!);
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const content = inputText.trim();
    setInputText('');
    setSending(true);

    // Optimistic update
    const tempMessage: Message = {
      _id: `temp-${Date.now()}`,
      content,
      senderId: user?._id || '',
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMessage]);

    try {
      await messagingService.sendMessage(id!, content);
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m._id !== tempMessage._id));
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.senderId === user?._id;
    const showDate =
      index === 0 ||
      formatDate(item.createdAt) !== formatDate(messages[index - 1].createdAt);

    return (
      <>
        {showDate && (
          <View style={styles.dateHeader}>
            <Text style={[styles.dateText, { color: colors.textMuted }]}>
              {formatDate(item.createdAt)}
            </Text>
          </View>
        )}
        <View style={[styles.messageRow, isMe && styles.myMessageRow]}>
          <View
            style={[
              styles.messageBubble,
              isMe
                ? { backgroundColor: colors.primary }
                : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
            ]}
          >
            <Text style={[styles.messageText, { color: isMe ? '#fff' : colors.text }]}>
              {item.content}
            </Text>
            <Text
              style={[
                styles.messageTime,
                { color: isMe ? 'rgba(255,255,255,0.7)' : colors.textMuted },
              ]}
            >
              {formatTime(item.createdAt)}
            </Text>
          </View>
        </View>
      </>
    );
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: username || 'Chat' }} />
        <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: username || 'Chat' }} />
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item._id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="chatbubble-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No messages yet
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
                Start the conversation!
              </Text>
            </View>
          }
        />

        {/* Input Bar */}
        <View style={[styles.inputBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.background }]}
            placeholder="Type a message..."
            placeholderTextColor={colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: inputText.trim() ? colors.primary : colors.textMuted },
            ]}
            onPress={sendMessage}
            disabled={!inputText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    padding: 12,
    paddingBottom: 80,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  dateHeader: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    fontSize: 15,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
