/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/
// Windows dictation for the chat composer.
// Electron's webkitSpeechRecognition reports error "network" at once: this
// Chromium build has no Google speech key, so the browser recognizer never
// reaches a service. System.Speech runs on the machine instead.

import { spawn, type ChildProcess } from 'child_process';
import { Emitter, Event } from '../../../../base/common/event.js';
import { join } from '../../../../base/common/path.js';
import { isWindows } from '../../../../base/common/platform.js';
import { IServerChannel } from '../../../../base/parts/ipc/common/ipc.js';

export type DictationEvent = {
	type: 'ready' | 'recognized' | 'error' | 'stopped';
	text?: string;
	code?: string;
};

const SPEECH_SCRIPT = `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$WarningPreference = 'SilentlyContinue'
$VerbosePreference = 'SilentlyContinue'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
function Write-Line([string]$line) {
  [Console]::Out.WriteLine($line)
  [Console]::Out.Flush()
}
function Write-Event([string]$type, [string]$text, [string]$code) {
  $obj = @{ type = $type }
  if ($text) { $obj.text = $text }
  if ($code) { $obj.code = $code }
  Write-Line ($obj | ConvertTo-Json -Compress)
}
try {
  Add-Type -AssemblyName System.Speech
  $lang = [Environment]::GetEnvironmentVariable('KUUNDA_SPEECH_LANG')
  $engine = $null
  if ($lang) {
    try {
      $culture = New-Object System.Globalization.CultureInfo $lang
      $engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine $culture
    } catch {
      $engine = $null
    }
  }
  if (-not $engine) {
    $installed = @([System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers())
    if ($installed.Count -eq 0) {
      Write-Event 'error' '' 'no-recognizer'
      exit 2
    }
    $engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine
  }
  try {
    $engine.SetInputToDefaultAudioDevice()
  } catch {
    Write-Event 'error' '' 'no-audio'
    exit 3
  }
  $engine.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
  $engine.InitialSilenceTimeout = [TimeSpan]::FromSeconds(10)
  $engine.BabbleTimeout = [TimeSpan]::FromSeconds(4)
  $engine.EndSilenceTimeout = [TimeSpan]::FromMilliseconds(700)
  Write-Event 'ready' '' ''
  while ($true) {
    $result = $engine.Recognize()
    if ($result -and $result.Text) {
      Write-Event 'recognized' ([string]$result.Text) ''
    }
  }
} catch {
  $msg = [string]$_.Exception.Message
  $code = 'recognizer'
  if ($msg -match 'audio|micro|device|wave') { $code = 'no-audio' }
  elseif ($msg -match 'recognizer|culture|language|grammar|404') { $code = 'no-recognizer' }
  Write-Event 'error' '' $code
  exit 1
}
`;

function speechLanguage(value: unknown): string {
	const lang = String(value || '').trim();
	return /^[a-z]{2}(?:-[A-Za-z]{2})?$/.test(lang) ? lang : '';
}

function powershellPath(): string {
	const root = process.env['SystemRoot'] || 'C:\\Windows';
	return join(root, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
}

type PendingStart = {
	resolve: () => void;
	reject: (error: Error) => void;
	timer: ReturnType<typeof setTimeout>;
};

export class DictationChannel implements IServerChannel {
	private readonly emitter = new Emitter<DictationEvent>();
	private child: ChildProcess | undefined;
	private generation = 0;
	private pending: PendingStart | undefined;
	private pendingBytes = Buffer.alloc(0);
	private encoding: 'utf8' | 'utf16le' | undefined;

	listen<T>(_context: unknown, event: string): Event<T> {
		if (event !== 'onDictation') {
			throw new Error(`Event not found: ${event}`);
		}
		return this.emitter.event as Event<T>;
	}

	call(_context: unknown, command: string, arg?: { language?: string }): Promise<void> {
		if (command === 'start') {
			return this.start(arg?.language);
		}
		if (command === 'stop') {
			this.stop();
			return Promise.resolve();
		}
		throw new Error(`Command not found: ${command}`);
	}

	private async start(language: string | undefined): Promise<void> {
		this.stop();
		if (!isWindows) {
			throw new Error('unsupported');
		}
		const generation = ++this.generation;
		const ready = new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => {
				if (generation !== this.generation) {
					return;
				}
				this.failStart('timeout');
				this.generation++;
				this.kill();
			}, 20000);
			this.pending = { resolve, reject, timer };
		});
		this.spawn(generation, speechLanguage(language));
		return ready;
	}

	private stop(): void {
		this.generation++;
		this.failStart('aborted');
		this.kill();
	}

	private kill(): void {
		const child = this.child;
		this.child = undefined;
		this.pendingBytes = Buffer.alloc(0);
		this.encoding = undefined;
		if (child && !child.killed) {
			child.kill();
		}
	}

	private spawn(generation: number, language: string): void {
		let child: ChildProcess;
		try {
			child = spawn(powershellPath(), [
				'-NoProfile',
				'-NonInteractive',
				'-ExecutionPolicy', 'Bypass',
				'-EncodedCommand', Buffer.from(SPEECH_SCRIPT, 'utf16le').toString('base64'),
			], {
				windowsHide: true,
				stdio: ['ignore', 'pipe', 'pipe'],
				env: { ...process.env, KUUNDA_SPEECH_LANG: language },
			});
		} catch {
			this.failStart('recognizer');
			return;
		}
		this.child = child;
		child.stdout?.on('data', (chunk: Buffer) => this.push(generation, chunk));
		child.on('error', () => {
			if (generation !== this.generation) {
				return;
			}
			if (this.pending) {
				this.failStart('recognizer');
			} else {
				this.emitter.fire({ type: 'error', code: 'recognizer' });
			}
		});
		child.on('exit', () => {
			if (generation !== this.generation) {
				return;
			}
			this.child = undefined;
			if (this.pending) {
				this.failStart('recognizer');
			} else {
				this.emitter.fire({ type: 'error', code: 'recognizer' });
			}
		});
	}

	private push(generation: number, chunk: Buffer): void {
		if (generation !== this.generation) {
			return;
		}
		this.pendingBytes = Buffer.concat([this.pendingBytes, chunk]);
		if (!this.encoding && this.pendingBytes.length >= 2) {
			const utf16 = this.pendingBytes[1] === 0 || (this.pendingBytes[0] === 0xFF && this.pendingBytes[1] === 0xFE);
			this.encoding = utf16 ? 'utf16le' : 'utf8';
		}
		if (!this.encoding) {
			return;
		}
		const separator = this.encoding === 'utf16le' ? Buffer.from('\n', 'utf16le') : Buffer.from('\n');
		let index = this.pendingBytes.indexOf(separator);
		while (index >= 0) {
			const raw = this.pendingBytes.subarray(0, index);
			this.pendingBytes = this.pendingBytes.subarray(index + separator.length);
			const line = raw.toString(this.encoding).replace(/^\uFEFF/, '').replace(/\r$/, '').trim();
			if (line) {
				this.onLine(generation, line);
			}
			index = this.pendingBytes.indexOf(separator);
		}
	}

	private onLine(generation: number, line: string): void {
		if (generation !== this.generation) {
			return;
		}
		let event: DictationEvent;
		try {
			event = JSON.parse(line) as DictationEvent;
		} catch {
			return;
		}
		if (event.type === 'ready') {
			this.succeedStart();
			return;
		}
		if (event.type === 'error') {
			const code = event.code || 'recognizer';
			if (this.pending) {
				this.failStart(code);
			} else {
				this.emitter.fire({ type: 'error', code });
			}
			this.generation++;
			this.kill();
			return;
		}
		if (event.type === 'recognized' && event.text?.trim()) {
			this.emitter.fire({ type: 'recognized', text: event.text });
		}
	}

	private succeedStart(): void {
		const pending = this.pending;
		this.pending = undefined;
		if (!pending) {
			return;
		}
		clearTimeout(pending.timer);
		pending.resolve();
	}

	private failStart(code: string): void {
		const pending = this.pending;
		this.pending = undefined;
		if (!pending) {
			return;
		}
		clearTimeout(pending.timer);
		pending.reject(new Error(code));
	}
}
