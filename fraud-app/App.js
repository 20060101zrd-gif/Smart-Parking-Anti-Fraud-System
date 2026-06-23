import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, SafeAreaView, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';

// ⚠️ 【关键修改】将这里改成你电脑真实的 IPv4 地址，否则手机连不上服务器！
// 例如: 'http://192.168.1.5:3000'
const BACKEND_URL = 'http://192.168.16.46:3000';


export default function App() {
  const [phoneInput, setPhoneInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [activeUser, setActiveUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async () => {
    if (phoneInput.length !== 11) return Alert.alert("提示", "请输入11位手机号");
    if (!nameInput) return Alert.alert("提示", "请输入真实姓名");

    setIsLoading(true);
    try {
      // 打包成 JSON 发送给后端
      const response = await fetch(`${BACKEND_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneInput, name: nameInput })
      });
      const result = await response.json();
      if (result.success) setActiveUser(result.data);
    } catch (error) {
      Alert.alert("连接失败", "无法连接服务器。请检查 IP 是否正确，且手机电脑在同一 Wi-Fi 下。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelAccount = () => {
    Alert.alert("危险操作", "注销后资料将被服务器合规删除，确定吗？", [
      { text: "取消", style: "cancel" },
      { 
        text: "注销", style: "destructive",
        onPress: async () => {
          setIsLoading(true);
          try {
            await fetch(`${BACKEND_URL}/api/cancel`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ phone: activeUser.phone, hash: activeUser.hash })
            });
            Alert.alert("成功", "个人明文资料已从云端永久擦除。");
            setActiveUser(null); setPhoneInput(''); setNameInput('');
          } catch (error) {
            Alert.alert("错误", "连接失败");
          } finally {
            setIsLoading(false);
          }
        }
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Feather name="smartphone" size={24} color="white" />
          <Text style={styles.headerText}>智慧停车 (客户端)</Text>
        </View>

        <View style={styles.mainContent}>
          {!activeUser ? (
            <View style={styles.card}>
              <View style={styles.avatarCircle}><Feather name="user" size={32} color="#2563eb" /></View>
              <Text style={styles.title}>新用户注册</Text>
              
              <TextInput style={styles.input} placeholder="11位手机号" keyboardType="numeric" maxLength={11} value={phoneInput} onChangeText={setPhoneInput} />
              <TextInput style={styles.input} placeholder="真实姓名" value={nameInput} onChangeText={setNameInput} />
              
              <TouchableOpacity style={styles.btnPrimary} onPress={handleRegister} disabled={isLoading}>
                {isLoading ? <ActivityIndicator color="white" /> : <Text style={styles.btnPrimaryText}>登 录</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.card}>
              <View style={styles.userInfoBox}>
                <Feather name="check-circle" size={28} color="#2563eb" style={{marginRight: 12}} />
                <View>
                  <Text style={styles.userName}>{activeUser.name}</Text>
                  <Text style={styles.userPhone}>{activeUser.phone}</Text>
                </View>
              </View>

              <View style={[styles.couponBox, activeUser.hasCoupon ? styles.couponSuccess : styles.couponFail]}>
                <Text style={[styles.couponTitle, {color: activeUser.hasCoupon ? '#15803d' : '#b91c1c'}]}>
                  {activeUser.hasCoupon ? "🎟️ 新人免费停车券：已到账" : "❌ 发放拦截：命中历史注销库"}
                </Text>
              </View>

              <TouchableOpacity style={styles.btnDanger} onPress={handleCancelAccount} disabled={isLoading}>
                 {isLoading ? <ActivityIndicator color="#ef4444" /> : <Text style={styles.btnDangerText}>注销账号 (云端物理删除)</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { backgroundColor: '#1e293b', padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: Platform.OS === 'android' ? 40 : 20 },
  headerText: { color: 'white', fontSize: 18, fontWeight: 'bold', marginLeft: 8 },
  mainContent: { flex: 1, padding: 20, justifyContent: 'center' },
  card: { backgroundColor: 'white', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 },
  avatarCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center', marginBottom: 16, alignSelf: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1e293b', marginBottom: 20, textAlign: 'center' },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, fontSize: 16, color: '#0f172a', marginBottom: 12 },
  btnPrimary: { backgroundColor: '#2563eb', width: '100%', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  btnPrimaryText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  userInfoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', padding: 16, borderRadius: 16, marginBottom: 24, borderWidth: 1, borderColor: '#e2e8f0' },
  userName: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  userPhone: { fontSize: 14, color: '#64748b', marginTop: 2 },
  couponBox: { padding: 20, borderRadius: 16, borderWidth: 1, marginBottom: 30 },
  couponSuccess: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  couponFail: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  couponTitle: { fontSize: 15, fontWeight: 'bold' },
  btnDanger: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', borderWidth: 1, borderColor: '#fecaca', paddingVertical: 14, borderRadius: 12 },
  btnDangerText: { color: '#ef4444', fontWeight: 'bold' }
});