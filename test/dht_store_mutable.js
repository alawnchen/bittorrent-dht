var common = require('./common')
var DHT = require('../')
var test = require('tape')
var ed = require('ed25519-supercop')
var sha = require('sha.js')

test('local mutable put/get', function (t) {
  t.plan(4)

  var keypair = ed.createKeyPair(ed.createSeed())

  var dht = new DHT({ bootstrap: false, verify: ed.verify })
  t.once('end', function () {
    dht.destroy()
  })
  common.failOnWarningOrError(t, dht)

  dht.on('ready', function () {
    var value = fill(500, 'abc')
    var opts = {
      k: keypair.publicKey,
      sign: sign(keypair),
      seq: 0,
      v: value
    }
    var expectedHash = sha('sha1').update(opts.k).digest()

    dht.put(opts, function (errors, hash) {
      errors.forEach(t.error.bind(t))

      t.equal(
        hash.toString('hex'),
        expectedHash.toString('hex'),
        'hash of the public key'
      )
      dht.get(hash, function (err, res) {
        t.ifError(err)
        t.equal(res.v.toString('utf8'), opts.v.toString('utf8'),
          'got back what we put in'
        )
        t.equal(res.seq, 0)
      })
    })
  })
})

test('multiparty mutable put/get', function (t) {
  t.plan(3)

  var keypair = ed.createKeyPair(ed.createSeed())

  var dht1 = new DHT({ bootstrap: false, verify: ed.verify })
  var dht2 = new DHT({ bootstrap: false, verify: ed.verify })

  t.once('end', function () {
    dht1.destroy()
    dht2.destroy()
  })
  common.failOnWarningOrError(t, dht1)
  common.failOnWarningOrError(t, dht2)

  var pending = 2
  dht1.listen(function () {
    dht2.addNode('127.0.0.1:' + dht1.address().port)
    dht2.once('node', ready)
  })

  dht2.listen(function () {
    dht1.addNode('127.0.0.1:' + dht2.address().port)
    dht1.once('node', ready)
  })

  function ready () {
    if (--pending !== 0) return
    var value = fill(500, 'abc')
    var opts = {
      k: keypair.publicKey,
      seq: 0,
      sign: sign(keypair),
      v: value
    }
    var expectedHash = sha('sha1').update(opts.k).digest()

    dht1.put(opts, function (errors, hash) {
      errors.forEach(t.error.bind(t))

      t.equal(
        hash.toString('hex'),
        expectedHash.toString('hex'),
        'hash of the public key'
      )
      dht2.get(hash, function (err, res) {
        t.ifError(err)
        t.equal(res.v.toString('utf8'), opts.v.toString('utf8'),
          'got back what we put in'
        )
      })
    })
  }
})

test('multiparty mutable put/get sequence', function (t) {
  t.plan(9)

  var keypair = ed.createKeyPair(ed.createSeed())
  var dht1 = new DHT({ bootstrap: false, verify: ed.verify })
  var dht2 = new DHT({ bootstrap: false, verify: ed.verify })

  t.once('end', function () {
    dht1.destroy()
    dht2.destroy()
  })
  common.failOnWarningOrError(t, dht1)
  common.failOnWarningOrError(t, dht2)

  var pending = 2
  dht1.listen(function () {
    dht2.addNode('127.0.0.1:' + dht1.address().port)
    dht2.once('node', ready)
  })

  dht2.listen(function () {
    dht1.addNode('127.0.0.1:' + dht2.address().port)
    dht1.once('node', ready)
  })

  function ready () {
    if (--pending !== 0) return
    var value = fill(500, 'abc')
    var opts = {
      k: keypair.publicKey,
      sign: sign(keypair),
      seq: 0,
      v: value
    }
    var expectedHash = sha('sha1').update(opts.k).digest()

    dht1.put(opts, function (errors, hash) {
      errors.forEach(t.error.bind(t))

      t.equal(
        hash.toString('hex'),
        expectedHash.toString('hex'),
        'hash of the public key'
      )
      dht2.get(hash, function (err, res) {
        t.ifError(err)
        t.equal(res.v.toString('utf8'), opts.v.toString('utf8'),
          'got back what we put in'
        )
        putSomethingElse()
      })
    })

    function putSomethingElse () {
      opts.seq ++
      opts.v = fill(32, 'whatever')

      dht1.put(opts, function (errors, hash) {
        errors.forEach(t.error.bind(t))

        t.equal(
          hash.toString('hex'),
          expectedHash.toString('hex'),
          'hash of the public key (again)'
        )
        dht2.get(hash, function (err, res) {
          t.ifError(err)
          t.equal(res.v.toString('utf8'), opts.v.toString('utf8'),
            'second update under the same key'
          )
          yetStillMore()
        })
      })
    }

    function yetStillMore () {
      opts.seq ++
      opts.v = fill(999, 'cool')

      dht1.put(opts, function (errors, hash) {
        errors.forEach(t.error.bind(t))

        t.equal(
          hash.toString('hex'),
          expectedHash.toString('hex'),
          'hash of the public key (yet again)'
        )
        dht2.get(hash, function (err, res) {
          t.ifError(err)
          t.equal(res.v.toString('utf8'), opts.v.toString('utf8'),
            'third update under the same key'
          )
        })
      })
    }
  }
})

test('salted multikey multiparty mutable put/get sequence', function (t) {
  t.plan(9)

  var keypair = ed.createKeyPair(ed.createSeed())

  var dht1 = new DHT({ bootstrap: false, verify: ed.verify })
  var dht2 = new DHT({ bootstrap: false, verify: ed.verify })

  t.once('end', function () {
    dht1.destroy()
    dht2.destroy()
  })
  common.failOnWarningOrError(t, dht1)
  common.failOnWarningOrError(t, dht2)

  var pending = 2
  dht1.listen(function () {
    dht2.addNode('127.0.0.1:' + dht1.address().port)
    dht2.once('node', ready)
  })

  dht2.listen(function () {
    dht1.addNode('127.0.0.1:' + dht2.address().port)
    dht1.once('node', ready)
  })

  function ready () {
    if (--pending !== 0) return
    var fvalue = fill(500, 'abc')
    var fopts = {
      k: keypair.publicKey,
      seq: 0,
      salt: Buffer('first'),
      sign: sign(keypair),
      v: fvalue
    }
    var svalue = fill(20, 'z')
    var sopts = {
      k: fopts.k,
      seq: 0,
      salt: Buffer('second'),
      sign: sign(keypair),
      v: svalue
    }
    var first = sha('sha1').update('first').update(fopts.k).digest()
    var second = sha('sha1').update('second').update(sopts.k).digest()

    dht1.put(fopts, function (errors, hash) {
      errors.forEach(t.error.bind(t))

      t.equal(
        hash.toString('hex'),
        first.toString('hex'),
        'first hash'
      )
      dht2.get(hash, function (err, res) {
        t.ifError(err)
        t.equal(res.v.toString('utf8'), fopts.v.toString('utf8'),
          'got back what we put in'
        )
        putSecondKey()
      })
    })

    function putSecondKey () {
      dht1.put(sopts, function (errors, hash) {
        errors.forEach(t.error.bind(t))

        t.equal(
          hash.toString('hex'),
          second.toString('hex'),
          'second hash'
        )
        dht2.get(hash, function (err, res) {
          t.ifError(err)
          t.equal(res.v.toString('utf8'), sopts.v.toString('utf8'),
            'second update under the same key'
          )
          yetStillMore()
        })
      })
    }

    function yetStillMore () {
      fopts.seq ++
      fopts.v = fill(999, 'cool')

      dht1.put(fopts, function (errors, hash) {
        errors.forEach(t.error.bind(t))

        t.equal(
          hash.toString('hex'),
          first.toString('hex'),
          'first salt (again)'
        )
        dht2.get(hash, function (err, res) {
          t.ifError(err)
          t.equal(res.v.toString('utf8'), fopts.v.toString('utf8'),
            'update with a different salt'
          )
        })
      })
    }
  }
})

test('transitive mutable update', function (t) {
  t.plan(3)

  var keypair = ed.createKeyPair(ed.createSeed())

  // dht1 <-> dht2 <-> dht3
  var dht1 = new DHT({ bootstrap: false, verify: ed.verify })
  var dht2 = new DHT({ bootstrap: false, verify: ed.verify })
  var dht3 = new DHT({ bootstrap: false, verify: ed.verify })

  t.once('end', function () {
    dht1.destroy()
    dht2.destroy()
    dht3.destroy()
  })
  common.failOnWarningOrError(t, dht1)
  common.failOnWarningOrError(t, dht2)
  common.failOnWarningOrError(t, dht3)

  var pending = 2
  dht1.listen(function () {
    dht2.addNode('127.0.0.1:' + dht1.address().port)
    dht2.once('node', ready)
  })

  dht2.listen(function () {
    dht3.addNode('127.0.0.1:' + dht2.address().port)
    dht3.once('node', ready)
  })

  function ready () {
    if (--pending !== 0) return
    var value = fill(500, 'abc')
    var opts = {
      k: keypair.publicKey,
      sign: sign(keypair),
      seq: 0,
      v: value
    }
    var expectedHash = sha('sha1').update(opts.k).digest()

    dht1.put(opts, function (errors, hash) {
      errors.forEach(t.error.bind(t))

      t.equal(
        hash.toString('hex'),
        expectedHash.toString('hex'),
        'hash of the public key'
      )

      dht3.get(expectedHash, function (err, res) {
        t.ifError(err)
        t.equal(res.v.toString('utf8'), opts.v.toString('utf8'),
          'got node 1 update from node 3'
        )
      })
    })
  }
})

test('mutable update mesh', function (t) {
  t.plan(9)
  /*
    0 <-> 1 <-> 2
          ^     ^
          |     |
          v     v
          3 <-> 4 <-> 5
          ^           ^
          |           |
          v           v
          6 <-> 7 <-> 8

    tests: 0 to 8, 4 to 6, 1 to 5
  */
  var edges = [
    [0, 1], [1, 2], [1, 3], [2, 4], [3, 4], [3, 6],
    [4, 5], [5, 8], [6, 7], [7, 8]
  ]

  var dht = []
  var pending = 0
  for (var i = 0; i < 9; i++) {
    (function (i) {
      var d = new DHT({ bootstrap: false, verify: ed.verify })
      dht.push(d)
      common.failOnWarningOrError(t, d)
      pending++
      d.listen(function () {
        if (--pending === 0) addEdges()
      })
    })(i)
  }

  function addEdges () {
    var pending = edges.length
    for (var i = 0; i < edges.length; i++) {
      (function (e) {
        dht[e[1]].addNode('127.0.0.1:' + dht[e[0]].address().port)
        dht[e[1]].once('node', function () {
          if (--pending === 0) ready()
        })
      })(edges[i])
    }
  }

  t.once('end', function () {
    for (var i = 0; i < dht.length; i++) {
      dht[i].destroy()
    }
  })

  function ready () {
    send(0, 8, fill(100, 'abc'))
    send(4, 6, fill(20, 'xyz'))
    send(1, 5, fill(500, 'whatever'))
  }

  function send (srci, dsti, value) {
    var src = dht[srci]
    var dst = dht[dsti]
    var keypair = ed.createKeyPair(ed.createSeed())
    var opts = {
      k: keypair.publicKey,
      sign: sign(keypair),
      seq: 0,
      v: value
    }
    var xhash = sha('sha1').update(opts.k).digest()
    src.put(opts, function (errors, hash) {
      errors.forEach(t.error.bind(t))
      t.equal(hash.toString('hex'), xhash.toString('hex'))

      dst.get(xhash, function (err, res) {
        t.ifError(err)
        t.equal(res.v.toString('utf8'), opts.v.toString('utf8'),
          'from ' + srci + ' to ' + dsti
        )
      })
    })
  }
})

test('invalid sequence', function (t) {
  t.plan(4)

  var keypair = ed.createKeyPair(ed.createSeed())

  var dht0 = new DHT({ bootstrap: false, verify: ed.verify })
  var dht1 = new DHT({ bootstrap: false, verify: ed.verify })
  dht0.listen(0, function () {
    dht1.addNode('127.0.0.1:' + dht0.address().port)
  })
  dht1.listen(0, function () {
    dht0.addNode('127.0.0.1:' + dht1.address().port)
  })
  t.once('end', function () {
    dht0.destroy()
    dht1.destroy()
  })
  common.failOnWarningOrError(t, dht0)
  common.failOnWarningOrError(t, dht1)

  dht0.on('node', function () {
    var opts0 = {
      k: keypair.publicKey,
      sign: sign(keypair),
      seq: 5,
      v: fill(500, '5')
    }
    var opts1 = {
      k: keypair.publicKey,
      sign: sign(keypair),
      seq: 4,
      v: fill(500, '4')
    }
    var hash0

    dht0.put(opts0, function (errors, hash) {
      errors.forEach(t.error.bind(t))
      hash0 = hash
      dht0.put(opts1, function (errors, hash) {
        t.ok(errors.length, 'caught expected error: ' + errors[0])
        check()
      })
    })

    function check () {
      dht1.get(hash0, function (err, res) {
        t.ifError(err)
        t.deepEqual(
          res.v.toString('utf8'),
          fill(500, '5').toString('utf8'),
          'greater sequence expected'
        )
        t.equal(res.seq, 5)
      })
    }
  })
})

test('valid sequence', function (t) {
  t.plan(4)

  var keypair = ed.createKeyPair(ed.createSeed())

  var dht0 = new DHT({ bootstrap: false, verify: ed.verify })
  var dht1 = new DHT({ bootstrap: false, verify: ed.verify })
  dht0.listen(0, function () {
    dht1.addNode('127.0.0.1:' + dht0.address().port)
  })
  dht1.listen(0, function () {
    dht0.addNode('127.0.0.1:' + dht1.address().port)
  })
  t.once('end', function () {
    dht0.destroy()
    dht1.destroy()
  })
  common.failOnWarningOrError(t, dht0)
  common.failOnWarningOrError(t, dht1)

  dht0.on('node', function () {
    var opts0 = {
      k: keypair.publicKey,
      sign: sign(keypair),
      seq: 4,
      v: fill(500, '4')
    }
    var opts1 = {
      k: keypair.publicKey,
      sign: sign(keypair),
      seq: 5,
      v: fill(500, '5')
    }
    var hash0, hash1

    dht0.put(opts0, function (errors, hash) {
      errors.forEach(t.error.bind(t))
      hash0 = hash
      dht0.put(opts1, function (errors, hash) {
        errors.forEach(t.error.bind(t))
        hash1 = hash
        t.deepEqual(hash0, hash1)
        check()
      })
    })

    function check () {
      dht1.get(hash0, function (err, res) {
        t.ifError(err)
        t.deepEqual(
          res.v.toString('utf8'),
          fill(500, '5').toString('utf8'),
          'greater sequence expected'
        )
        t.equal(res.seq, 5)
      })
    }
  })
})

function fill (n, s) {
  var bs = Buffer(s)
  var b = new Buffer(n)
  for (var i = 0; i < n; i++) {
    b[i] = bs[i % bs.length]
  }
  return b
}

function sign (keypair) {
  return function (buf) {
    return ed.sign(buf, keypair.publicKey, keypair.secretKey)
  }
}
