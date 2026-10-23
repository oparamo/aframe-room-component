import * as THREE from 'three';
import { installAframeMock } from './utils/mocks';

Object.assign(globalThis, { THREE });
installAframeMock();
