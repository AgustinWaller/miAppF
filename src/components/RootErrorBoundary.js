import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }
  componentDidCatch(error, info) {
    console.error('RootErrorBoundary caught:', error, info?.componentStack);
    this.setState({ error, info });
  }
  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Se produjo un error</Text>
        <Text style={styles.msg}>{String(error?.message || error)}</Text>
        {!!info?.componentStack && (
          <Text style={styles.stack}>{info.componentStack}</Text>
        )}
      </ScrollView>
    );
  }
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 16, paddingTop: 48, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 8, color: '#b00020' },
  msg: { color: '#333', marginBottom: 12 },
  stack: { color: '#666', fontSize: 12 },
});

